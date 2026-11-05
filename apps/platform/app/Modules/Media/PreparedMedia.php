<?php

namespace App\Modules\Media;

final readonly class PreparedMedia
{
    public function __construct(
        public string $path, public string $kind, public string $mime,
        public int $bytes, public string $sha256, public ?float $duration,
    ) {}
}
