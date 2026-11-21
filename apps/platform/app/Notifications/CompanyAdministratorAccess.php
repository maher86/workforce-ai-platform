<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class CompanyAdministratorAccess extends Notification
{
    public function __construct(public string $company, public ?string $token = null) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $base = rtrim((string) (config('workforce.public_url') ?: config('app.url')), '/');
        $url = $base.($this->token === null ? '/login' : route('password.reset', ['token' => $this->token, 'email' => $notifiable->email], false));

        return (new MailMessage)
            ->subject('Company administrator access · '.$this->company)
            ->line('You have been given administrator access to '.$this->company.'.')
            ->line($this->token === null ? 'Sign in with your existing account.' : 'Choose your own password, then sign in and verify your email to open the company dashboard.')
            ->action($this->token === null ? 'Sign in' : 'Set password', $url)
            ->line('If you did not expect this invitation, you can ignore it.');
    }
}
