<?php

namespace Tests\Feature;

use App\Modules\Media\MediaInput;
use App\Modules\Media\PrepareMedia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class NativeAudioTest extends TestCase
{
    /** @var list<string> */
    private array $files = [];

    protected function tearDown(): void
    {
        foreach ($this->files as $file) {
            if (is_file($file)) {
                unlink($file);
            }
        }
        parent::tearDown();
    }

    private function fixture(string $format, bool $video = false): string
    {
        $file = tempnam(sys_get_temp_dir(), 'workforce-native-synthetic-');
        $this->files[] = $file;
        $args = ['ffmpeg', '-nostdin', '-v', 'error'];
        if ($video) {
            $args = [...$args, '-f', 'lavfi', '-i', 'color=c=black:s=176x144:r=10:d=1'];
        }
        $args = [...$args, '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=16000:duration=1', '-ac', '1', '-c:a', 'aac', '-b:a', '24k'];
        if ($video) {
            $args = [...$args, '-c:v', 'h263', '-threads', '1'];
        }
        (new Process([...$args, '-t', '1', '-f', $format, '-y', $file]))->setTimeout(20)->mustRun();

        return $file;
    }

    public function test_native_audio_containers_are_decoded_and_normalized_privately(): void
    {
        Storage::fake('reports');
        foreach (['3gp', 'adts'] as $format) {
            $result = app(PrepareMedia::class)->prepare(new MediaInput($this->fixture($format), 'audio'));
            $this->assertSame('audio/mp4', $result->mime);
            $this->assertGreaterThan(0, $result->duration);
            $this->assertLessThan(3, $result->duration);
            $this->assertGreaterThan(0, $result->bytes);
            Storage::disk('reports')->assertExists($result->path);
            $this->assertStringStartsWith('.incoming/', $result->path);
        }
    }

    public function test_3gp_with_video_is_still_rejected_as_audio_without_leaving_output(): void
    {
        Storage::fake('reports');
        try {
            app(PrepareMedia::class)->prepare(new MediaInput($this->fixture('3gp', true), 'audio'));
            $this->fail('Video must not be accepted as employee audio.');
        } catch (ValidationException) {
            $this->assertSame([], Storage::disk('reports')->allFiles());
        }
    }
}
