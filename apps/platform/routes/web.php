<?php

use App\Http\Controllers\EmployeeAccessController;
use App\Http\Controllers\EmployeeProfileController;
use App\Http\Controllers\EmployeeReportController;
use App\Http\Controllers\ManagerReportController;
use App\Http\Controllers\ServiceFactsController;
use App\Http\Controllers\WorkforceController;
use App\Http\Controllers\WorkInsightsController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::post('tenants/{tenant}/reports/{report}/service-facts', [ServiceFactsController::class, 'store'])->whereNumber(['tenant', 'report'])->middleware('throttle:30,1');
    Route::get('tenants/{tenant}/insights', [WorkInsightsController::class, 'index'])->whereNumber('tenant');
    Route::get('tenants/{tenant}/vehicles', [WorkInsightsController::class, 'vehicles'])->whereNumber('tenant');
    Route::get('tenants/{tenant}/vehicles/{vehicle}', [WorkInsightsController::class, 'vehicle'])->whereNumber(['tenant', 'vehicle']);
    Route::get('tenants/{tenant}/reports/by-day', [ManagerReportController::class, 'day'])->whereNumber('tenant');
    Route::post('tenants/{tenant}/reports/{report}/vehicle', [WorkInsightsController::class, 'assign'])->whereNumber(['tenant', 'report'])->middleware('throttle:30,1');
    Route::post('tenants/{tenant}/employees/{membership}/profile', [EmployeeProfileController::class, 'managerUpdate'])->whereNumber(['tenant', 'membership'])->middleware('throttle:20,1');
    Route::get('tenants/{tenant}/employees/{membership}/photo', [EmployeeProfileController::class, 'managerPhoto'])->whereNumber(['tenant', 'membership']);
    Route::get('tenants/{tenant}/reports', [ManagerReportController::class, 'index'])->whereNumber('tenant');
    Route::get('tenants/{tenant}/reports/export', [ManagerReportController::class, 'export'])->whereNumber('tenant');
    Route::get('tenants/{tenant}/reports/{report}/source-history/{change}', [ManagerReportController::class, 'sourceHistory'])->whereNumber(['tenant', 'report', 'change']);
    Route::get('tenants/{tenant}/reports/{report}', [ManagerReportController::class, 'show'])->whereNumber(['tenant', 'report']);
    Route::delete('tenants/{tenant}/reports/{report}', [ManagerReportController::class, 'destroy'])->whereNumber(['tenant', 'report'])->middleware('throttle:10,1');
    Route::get('tenants/{tenant}/reports/{report}/media/{media}', [ManagerReportController::class, 'media'])->whereNumber(['tenant', 'report', 'media']);
    Route::post('tenants/{tenant}/reports/{report}/review', [ManagerReportController::class, 'review'])->whereNumber(['tenant', 'report'])->middleware('throttle:30,1');
    Route::post('tenants/{tenant}/reports/{report}/retry', [ManagerReportController::class, 'retry'])->whereNumber(['tenant', 'report'])->middleware('throttle:10,1');
    Route::post('tenants/{tenant}/work', [ManagerReportController::class, 'work'])->whereNumber('tenant')->middleware('throttle:30,1');
    Route::post('tenants/{tenant}/work/{work}/close', [ManagerReportController::class, 'closeWork'])->whereNumber(['tenant', 'work']);
    Route::get('dashboard', [WorkforceController::class, 'index'])->name('dashboard');
    Route::get('tenants/{tenant}/team', [WorkforceController::class, 'index'])->whereNumber('tenant')->name('team');
    Route::post('tenants', [WorkforceController::class, 'createTenant'])->middleware('throttle:10,1');
    Route::post('tenants/{tenant}/employees', [WorkforceController::class, 'addEmployee'])->whereNumber('tenant')->middleware('throttle:20,1');
    Route::post('tenants/{tenant}/employees/{membership}/invite', [WorkforceController::class, 'invite'])->whereNumber(['tenant', 'membership'])->middleware('throttle:20,1');
    Route::post('tenants/{tenant}/employees/{membership}/revoke', [WorkforceController::class, 'revoke'])->whereNumber(['tenant', 'membership'])->middleware('throttle:20,1');
    Route::post('tenants/{tenant}/employees/{membership}/enable', [WorkforceController::class, 'enable'])->whereNumber(['tenant', 'membership'])->middleware('throttle:20,1');
    Route::post('tenants/{tenant}/managers', [WorkforceController::class, 'addManager'])->whereNumber('tenant')->middleware('throttle:5,1');
    Route::post('tenants/{tenant}/managers/{membership}/disable', [WorkforceController::class, 'removeManager'])->whereNumber(['tenant', 'membership'])->middleware('throttle:5,1');
});

Route::inertia('employee/connect', 'employee/connect')->name('employee.connect');
Route::get('employee/activate', [EmployeeAccessController::class, 'activationPage'])->middleware('throttle:30,1');
Route::post('employee/activate', [EmployeeAccessController::class, 'activate'])->middleware('throttle:10,1');
Route::get('employee', [EmployeeAccessController::class, 'home'])->middleware('auth')->name('employee.home');
Route::post('employee/disconnect', [EmployeeAccessController::class, 'disconnect'])->middleware('auth');
Route::post('employee/profile', [EmployeeProfileController::class, 'update'])->middleware(['auth', 'throttle:10,1']);
Route::get('employee/profile/photo', [EmployeeProfileController::class, 'photo'])->middleware('auth');
Route::post('employee/reports', [EmployeeReportController::class, 'store'])->middleware(['auth', 'throttle:10,1']);
Route::get('employee/report-days', [EmployeeReportController::class, 'day'])->middleware('auth');
Route::get('employee/history', [EmployeeReportController::class, 'history'])->middleware('auth');
Route::post('employee/reports/{report}/amend', [EmployeeReportController::class, 'change'])->whereNumber('report')->middleware(['auth', 'throttle:20,1']);
Route::delete('employee/reports/{report}', [EmployeeReportController::class, 'destroy'])->whereNumber('report')->middleware(['auth', 'throttle:20,1']);
Route::get('employee/reports/{report}', [EmployeeReportController::class, 'show'])->whereNumber('report')->middleware('auth');
Route::get('employee/reports/{report}/media/{media}', [EmployeeReportController::class, 'media'])->whereNumber(['report', 'media'])->middleware('auth');

require __DIR__.'/settings.php';
