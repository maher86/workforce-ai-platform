<?php

namespace App\Modules\Reporting;

use App\Modules\WorkManagement\Vehicle;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Validator;

class ReportActivity
{
    public const ZONE = 'Asia/Dubai';

    public const DAY = "(reports.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Dubai')::date";

    /** @param Builder<Report> $query
     * @return LengthAwarePaginator<int, Report>
     */
    public function days(Builder $query): LengthAwarePaginator
    {
        return (clone $query)->selectRaw(self::DAY.' as day, COUNT(*)::int as total')->groupByRaw(self::DAY)
            ->orderByDesc('day')->paginate(14, ['*'], 'days_page')->withQueryString();
    }

    /** @param Builder<Report> $query
     * @return LengthAwarePaginator<int, Report>
     */
    public function reports(Builder $query, string $day): LengthAwarePaginator
    {
        Validator::make(['day' => $day], ['day' => 'required|date_format:Y-m-d'])->validate();
        $start = CarbonImmutable::parse($day, self::ZONE)->startOfDay()->utc();

        return (clone $query)->where('reports.created_at', '>=', $start)->where('reports.created_at', '<', $start->addDay())
            ->select(['reports.id', 'reports.tenant_id', 'reports.membership_id', 'reports.vehicle_id', 'reports.status', 'reports.review_status', 'reports.created_at'])
            ->selectSub(Vehicle::query()->select('plate')->whereColumn('id', 'reports.vehicle_id')->whereColumn('tenant_id', 'reports.tenant_id')->limit(1), 'vehicle_plate')
            ->orderByDesc('reports.created_at')->orderByDesc('reports.id')->paginate(50, ['*'], 'reports_page');
    }

    /** @param array<string, mixed> $input
     * @return array{from: string, to: string}
     */
    public function period(array $input): array
    {
        $today = CarbonImmutable::now(self::ZONE)->startOfDay();
        $from = $input['from'] ?? $today->subDays(29)->toDateString();
        $to = $input['to'] ?? $today->toDateString();
        Validator::make(['from' => $from, 'to' => $to], ['from' => 'required|date_format:Y-m-d', 'to' => 'required|date_format:Y-m-d|after_or_equal:from'])->validate();
        Validator::make(['span' => CarbonImmutable::parse($from)->diffInDays(CarbonImmutable::parse($to))], ['span' => 'numeric|max:365'])->validate();

        return ['from' => $from, 'to' => $to];
    }

    /** @param Builder<Report> $query
     * @param  array{from: string, to: string}  $period
     * @return Builder<Report>
     */
    public function during(Builder $query, array $period): Builder
    {
        return $query->where('reports.created_at', '>=', CarbonImmutable::parse($period['from'], self::ZONE)->startOfDay()->utc())
            ->where('reports.created_at', '<', CarbonImmutable::parse($period['to'], self::ZONE)->startOfDay()->addDay()->utc());
    }
}
