<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rules\Password;

class CreatePlatformAdministrator extends Command
{
    protected $signature = 'platform:create-admin {email} {--name=Platform administrator}';

    protected $description = 'Create a separate platform identity with an interactive private password; never promote a company account';

    public function handle(): int
    {
        $email = mb_strtolower(trim((string) $this->argument('email')));
        $data = ['email' => $email, 'name' => (string) $this->option('name')];
        $validator = Validator::make($data, ['email' => 'required|email|max:254|unique:users,email', 'name' => 'required|string|max:120']);
        if ($validator->fails()) {
            $this->error('A valid unused email and name are required. Existing customer accounts are never promoted.');

            return self::FAILURE;
        }
        $password = $this->secret('Password (12+ characters, upper/lowercase, number and symbol)');
        $confirmation = $this->secret('Confirm password');
        if (Validator::make(['password' => $password, 'password_confirmation' => $confirmation], ['password' => ['required', 'confirmed', Password::min(12)->letters()->mixedCase()->numbers()->symbols()]])->fails()) {
            $this->error('Password requirements or confirmation failed. No account created.');

            return self::FAILURE;
        }
        $user = new User;
        $user->forceFill([...$data, 'password' => $password, 'platform_admin' => true, 'company_id' => null, 'employee_only' => false])->save();
        $this->info('Platform account created. Sign in, verify email using the resend button, and enable two-factor authentication before opening /platform. No company access or customer impersonation was granted.');

        return self::SUCCESS;
    }
}
