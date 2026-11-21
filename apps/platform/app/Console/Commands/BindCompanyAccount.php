<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Modules\Audit\Audit;
use App\Modules\Identity\Membership;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BindCompanyAccount extends Command
{
    protected $signature = 'company:bind-account {user} {tenant} {--expected-company=none} {--apply}';

    protected $description = 'Resolve a legacy account to an existing authorized company; dry-run by default, preserving all memberships and data';

    public function handle(): int
    {
        if (! ctype_digit((string) $this->argument('user')) || ! ctype_digit((string) $this->argument('tenant'))) {
            $this->error('Numeric user and company IDs are required.');

            return self::FAILURE;
        }

        return DB::transaction(function () {
            $user = User::query()->lockForUpdate()->find($this->argument('user'));
            $tenant = (int) $this->argument('tenant');
            $expected = (string) $this->option('expected-company');
            if (! $user || $user->employee_only || $user->platform_admin || (string) ($user->company_id ?? 'none') !== $expected
                || ! Membership::query()->where('user_id', $user->id)->where('tenant_id', $tenant)->where('active', true)->whereIn('role', ['owner', 'manager'])->exists()) {
                $this->error('Binding guard failed. No permissions or records changed.');

                return self::FAILURE;
            }
            if (! $this->option('apply')) {
                $this->info('Dry run passed. Repeat with --apply only after the account owner selects this company.');

                return self::SUCCESS;
            }
            $user->forceFill(['company_id' => $tenant])->save();
            Audit::record($tenant, null, 'company.operator_bound_account', 'user', $user->id);
            $this->info('Company bound. Other companies, memberships, reports and devices were preserved.');

            return self::SUCCESS;
        });
    }
}
