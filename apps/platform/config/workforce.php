<?php

return [
    'public_url' => env('WORKFORCE_PUBLIC_URL'),
    'trusted_proxy' => env('WORKFORCE_TRUSTED_PROXIES'),
    'ai_provider' => env('WORKFORCE_AI_PROVIDER', 'demo'),
    'openai_key' => env('OPENAI_API_KEY'),
    'transcription_model' => env('OPENAI_TRANSCRIPTION_MODEL', 'gpt-transcribe'),
    'report_model' => env('OPENAI_REPORT_MODEL', 'gpt-5-mini'),
];
