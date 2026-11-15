<?php

namespace App\Modules\AIProcessing;

use App\Modules\Reporting\Report;
use App\Modules\Reporting\ReportMedia;
use App\Modules\Reporting\ReportOutput;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class ReportPipeline
{
    /** @return array<string, string> */
    public function sources(Report $report): array
    {
        $sources = $report->source_text !== null ? ['text' => $report->source_text] : [];
        foreach (ReportOutput::query()->where('tenant_id', $report->tenant_id)->where('report_id', $report->id)->where('stage', 'like', 'transcript:%')->get() as $output) {
            $sources[str_replace('transcript:', 'audio:', $output->stage)] = (string) $output->payload['text'];
        }

        return $sources;
    }

    /** @return array{key: string, kind: string, context: array<string, mixed>}|null */
    public function next(Report $report): ?array
    {
        $done = ReportOutput::query()->where('tenant_id', $report->tenant_id)->where('report_id', $report->id)->pluck('stage')->all();
        $media = ReportMedia::query()->whereNull('retired_at')->where('tenant_id', $report->tenant_id)->where('report_id', $report->id)->orderBy('id')->get();
        foreach ($media->where('kind', 'audio') as $item) {
            if (! in_array('transcript:'.$item->id, $done, true)) {
                return ['key' => 'transcript:'.$item->id, 'kind' => 'transcript', 'context' => ['path' => Storage::disk('reports')->path($item->path)]];
            }
        }
        $sources = $this->sources($report);
        if (! in_array('translation', $done, true)) {
            return ['key' => 'translation', 'kind' => 'translation', 'context' => ['data' => ['sources' => $sources]]];
        }
        if ($report->analysis_mode === 'text') {
            return null;
        }
        foreach ($media->where('kind', 'image') as $item) {
            if (! in_array('image:'.$item->id, $done, true)) {
                return ['key' => 'image:'.$item->id, 'kind' => 'image', 'context' => ['path' => Storage::disk('reports')->path($item->path), 'data' => ['source_id' => 'image:'.$item->id]]];
            }
        }
        if (! in_array('structured', $done, true)) {
            $observations = ReportOutput::query()->where('tenant_id', $report->tenant_id)->where('report_id', $report->id)->where('stage', 'like', 'image:%')->get()->mapWithKeys(fn (ReportOutput $output) => [$output->stage => $output->payload])->all();
            $translation = ReportOutput::query()->where('tenant_id', $report->tenant_id)->where('report_id', $report->id)->where('stage', 'translation')->firstOrFail();

            return ['key' => 'structured', 'kind' => 'structured', 'context' => ['data' => ['sources' => $sources, 'english_translation' => $translation->payload, 'unverified_images' => $observations]]];
        }

        return null;
    }

    /** @param array<string, mixed> $payload */
    public function validate(Report $report, string $kind, array $payload): void
    {
        $rules = match ($kind) {
            'transcript' => ['text' => 'required|string|max:20000', 'language' => 'required|string|max:30'],
            'translation' => ['english' => 'required|string|max:30000', 'uncertainties' => 'present|array|max:30', 'uncertainties.*' => 'string|max:2000'],
            'image' => ['observations' => 'present|array|max:30', 'observations.*' => 'string|max:2000', 'uncertainties' => 'present|array|max:30', 'uncertainties.*' => 'string|max:2000'],
            default => ['summary' => 'required|string|max:10000', 'claims' => 'present|array|max:50', 'claims.*.description' => 'required|string|max:2000', 'claims.*.evidence_ids' => 'required|array|min:1|max:5', 'claims.*.evidence_ids.*' => 'required|string', 'claims.*.quantity' => 'present|nullable|string|max:200', 'claims.*.quantity_quote' => 'present|nullable|string|max:2000', 'claims.*.completion' => 'required|in:unknown,employee_reported_complete', 'claims.*.completion_quote' => 'present|nullable|string|max:2000', 'uncertainties' => 'present|array|max:30', 'uncertainties.*' => 'string|max:2000'],
        };
        Validator::make($payload, $rules)->validate();
        if ($kind !== 'structured') {
            return;
        }
        $sources = $this->sources($report);
        $images = ReportMedia::query()->whereNull('retired_at')->where('tenant_id', $report->tenant_id)->where('report_id', $report->id)->where('kind', 'image')->pluck('id')->map(fn ($id) => 'image:'.$id)->all();
        foreach ($payload['claims'] as $claim) {
            $textEvidence = [];
            foreach ($claim['evidence_ids'] as $reference) {
                if (! array_key_exists($reference, $sources) && ! in_array($reference, $images, true)) {
                    throw new RuntimeException('unknown_evidence');
                }
                if (array_key_exists($reference, $sources)) {
                    $textEvidence[] = $sources[$reference];
                }
            }
            foreach (['quantity', 'completion'] as $field) {
                $claimed = $field === 'quantity' ? $claim['quantity'] !== null : $claim['completion'] !== 'unknown';
                if ($claimed) {
                    $quote = $claim[$field.'_quote'];
                    $found = is_string($quote) && $quote !== '' && count(array_filter($textEvidence, fn (string $source) => str_contains($source, $quote))) > 0;
                    if (! $found || ($field === 'quantity' && ! str_contains($quote, $claim['quantity']))) {
                        throw new RuntimeException('unsupported_quantity_or_completion');
                    }
                }
            }
        }
    }
}
