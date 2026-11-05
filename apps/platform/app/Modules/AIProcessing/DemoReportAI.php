<?php

namespace App\Modules\AIProcessing;

class DemoReportAI implements ReportAI
{
    public function run(string $stage, array $context): StageResult
    {
        $payload = match ($stage) {
            'transcript' => ['text' => '[Demo: audio not transcribed.]', 'language' => 'und'],
            'translation' => ['english' => '[Demo: translation unavailable. Review the original sources.]', 'uncertainties' => ['Demonstration provider; no translation was performed.']],
            'image' => ['observations' => [], 'uncertainties' => ['Demonstration provider; image not analyzed.']],
            default => ['summary' => 'Demonstration report. Review the original employee submission; AI has not analyzed it.', 'claims' => [], 'uncertainties' => ['Demo mode. No quantities or completion are verified.']],
        };

        return new StageResult($payload, 'deterministic-demo-v1');
    }
}
