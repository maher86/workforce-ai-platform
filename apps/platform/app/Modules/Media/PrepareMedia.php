<?php

namespace App\Modules\Media;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;
use Throwable;

class PrepareMedia
{
    public function prepare(MediaInput $input, int $maxDimension = 2560): PreparedMedia
    {
        $disk = Storage::disk('reports');
        $target = '.incoming/'.Str::uuid().($input->kind === 'image' ? '.jpg' : '.m4a');
        $disk->makeDirectory('.incoming');
        try {
            $size = filesize($input->sourcePath);
            $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($input->sourcePath);
            $this->require($size !== false && $size > 0 && $size <= 12 * 1024 * 1024);
            $duration = null;
            if ($input->kind === 'image') {
                $this->require(in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true));
                $dimensions = @getimagesize($input->sourcePath);
                if ($dimensions === false) {
                    throw ValidationException::withMessages(['media' => 'الصورة غير قابلة للقراءة.']);
                }
                $this->require($dimensions[0] > 0 && $dimensions[1] > 0 && $dimensions[0] * $dimensions[1] <= 20_000_000);
                $ratio = min(1, $maxDimension / $dimensions[0], $maxDimension / $dimensions[1]);
                $width = max(1, (int) floor($dimensions[0] * $ratio));
                $height = max(1, (int) floor($dimensions[1] * $ratio));
                $arguments = ['-frames:v', '1', '-vf', 'scale='.$width.':'.$height, '-q:v', '3', '-threads', '1'];
                $outputMime = 'image/jpeg';
            } else {
                $this->require($input->kind === 'audio' && in_array($mime, ['audio/mpeg', 'audio/mp4', 'video/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/webm', 'video/webm', 'audio/ogg', 'application/ogg'], true));
                $probe = new Process(['ffprobe', '-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', $input->sourcePath]);
                $probe->setTimeout(10)->mustRun();
                $metadata = json_decode($probe->getOutput(), true, 64, JSON_THROW_ON_ERROR);
                $duration = (float) ($metadata['format']['duration'] ?? 0);
                // Browser WebM often has no duration header; measure the decoded output.
                $this->require(is_finite($duration) && $duration <= 180);
                $streams = $metadata['streams'] ?? [];
                $this->require(count($streams) > 0);
                foreach ($streams as $stream) {
                    $this->require(($stream['codec_type'] ?? '') === 'audio');
                }
                $arguments = ['-t', '181', '-vn', '-ac', '1', '-ar', '24000', '-c:a', 'aac', '-b:a', '96k'];
                $outputMime = 'audio/mp4';
            }
            $process = new Process(['ffmpeg', '-nostdin', '-v', 'error', '-threads', '1', '-i', $input->sourcePath, '-map_metadata', '-1', ...$arguments, '-y', $disk->path($target)]);
            $process->setTimeout(25)->mustRun();
            if ($input->kind === 'audio') {
                $decoded = new Process(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', $disk->path($target)]);
                $decoded->setTimeout(10)->mustRun();
                $duration = (float) (json_decode($decoded->getOutput(), true, 32, JSON_THROW_ON_ERROR)['format']['duration'] ?? 0);
                $this->require(is_finite($duration) && $duration > 0 && $duration <= 180.1);
            }
            $outputSize = $disk->size($target);
            $this->require($outputSize > 0 && $outputSize <= 12 * 1024 * 1024);

            return new PreparedMedia($target, $input->kind, $outputMime, $outputSize, (string) hash_file('sha256', $disk->path($target)), $duration);
        } catch (Throwable $exception) {
            $disk->delete($target);
            if ($exception instanceof ValidationException) {
                throw $exception;
            }
            // Never expose upload paths, decoder output or media contents in errors/logs.
            throw ValidationException::withMessages(['media' => 'تعذّر قراءة الملف. استخدم صورة JPEG/PNG/WebP أو تسجيلًا صوتيًا صالحًا حتى 3 دقائق.']);
        }
    }

    private function require(bool $condition): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['media' => 'الملف غير مدعوم أو يتجاوز الحدود: 12MB، صورة حتى 20MP، أو صوت حتى 3 دقائق.']);
        }
    }
}
