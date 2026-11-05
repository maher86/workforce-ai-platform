<?php

namespace App\Modules\AIProcessing;

final readonly class StageResult
{
    /**
     * @param  array<string, mixed>  $payload
     * @param  array<string, mixed>  $usage
     */
    public function __construct(public array $payload, public string $model, public array $usage = [], public ?string $provider = null) {}
}
