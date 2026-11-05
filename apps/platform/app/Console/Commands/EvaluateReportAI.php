<?php

namespace App\Console\Commands;

use App\Modules\AIProcessing\OpenAIReportAI;
use App\Modules\AIProcessing\ReportPipeline;
use App\Modules\Reporting\Report;
use Illuminate\Console\Command;
use Throwable;

class EvaluateReportAI extends Command
{
    protected $signature = 'ai:evaluate {--run : Explicitly opt into paid API requests using built-in synthetic text only}';

    protected $description = 'Opt-in multilingual translation smoke; never claims speech/factual accuracy validation';

    public function handle(OpenAIReportAI $ai, ReportPipeline $pipeline): int
    {
        if (! $this->option('run') || ! filled(config('workforce.openai_key'))) {
            $this->warn('Not run. Requires a local OPENAI_API_KEY and explicit --run after API-spend approval. No credentials should be pasted in chat or committed.');

            return self::FAILURE;
        }
        $sources = [
            'Arabic' => 'لم أكمل العمل. ركبت ٣ ألواح فقط.',
            'Hindi' => 'आज तीन पैनल लगाए। काम पूरा नहीं हुआ।',
            'Urdu' => 'آج تین پینل لگائے۔ کام ابھی مکمل نہیں ہوا۔',
            'English' => 'I installed three panels. The work is not complete.',
        ];
        $failed = false;
        foreach ($sources as $language => $source) {
            try {
                $result = $ai->run('translation', ['data' => ['sources' => ['text' => $source]]]);
                $pipeline->validate(new Report, 'translation', $result->payload);
                $text = strtolower((string) $result->payload['english']);
                $quantity = preg_match('/\b(?:3|three)\b/', $text) === 1;
                $negation = preg_match('/not|incomplete|unfinished|didn|haven|hasn|remain/', $text) === 1;
                $pass = $quantity && $negation;
                $failed = $failed || ! $pass;
                $this->line($language.': '.($pass ? 'SMOKE PASS' : 'REVIEW REQUIRED').' · '.$result->model);
            } catch (Throwable) {
                $failed = true;
                $this->error($language.': request/schema failed (payload and credentials redacted).');
            }
        }
        $this->warn('This checks four synthetic text translations only. Human language review and approved multilingual speech/image fixtures are still required before pilot use.');

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
