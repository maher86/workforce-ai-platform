<?php

namespace App\Modules\Media;

final readonly class MediaInput
{
    public function __construct(public string $sourcePath, public string $kind) {}
}
