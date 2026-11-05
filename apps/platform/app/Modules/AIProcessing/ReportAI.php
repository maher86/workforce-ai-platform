<?php

namespace App\Modules\AIProcessing;

interface ReportAI
{
    /** @param array<string, mixed> $context */
    public function run(string $stage, array $context): StageResult;
}
