@extends('layouts.admin')

@section('title', 'Dashboard')

@section('content')
@php
    // View-only summary of the grouped appointments the controller supplies.
    // The rule is stated here rather than inherited from the controller's query: an appointment only counts as
    // "upcoming" / "still to come" if it has not started yet, so the tiles stay truthful even if that query changes.
    $notStarted = function ($a) { return $a->appointment_start->isFuture(); };
    $upcomingTotal = $appointments->sum(function ($day) use ($notStarted) {
        return $day->filter($notStarted)->count();
    });
    $todayRemaining = $appointments->sum(function ($day) use ($notStarted) {
        return $day->filter(function ($a) use ($notStarted) {
            return $a->appointment_start->isToday() && $notStarted($a);
        })->count();
    });
@endphp

@component('components.page-header', [
    'title' => 'Dashboard',
    'subtitle' => 'Upcoming appointments, soonest first',
])
    @slot('actions')
        <a href="{{ route('admin.appointment.list') }}" class="btn btn-secondary">All appointments</a>
        <a href="{{ route('admin.patient.create') }}" class="btn btn-primary">Add client</a>
    @endslot
@endcomponent

<div class="stat-grid" role="list" aria-label="Appointment summary">
    <div class="stat" role="listitem">
        <span class="stat__value">{{ $upcomingTotal }}</span>
        <span class="stat__label">Upcoming appointments</span>
    </div>
    <div class="stat" role="listitem">
        <span class="stat__value">{{ $todayRemaining }}</span>
        <span class="stat__label">Still to come today</span>
    </div>
    <div class="stat" role="listitem">
        <span class="stat__value">{{ $appointments->count() }}</span>
        <span class="stat__label">Days with bookings</span>
    </div>
</div>

@forelse ($appointments as $day)
    @php
        $first = $day->first();
        $isToday = $first->appointment_start->isToday();
    @endphp
    <section class="day-group {{ $isToday ? 'day-group--today' : '' }}" aria-labelledby="day-{{ $loop->index }}">
        <header class="day-group__date">
            <span class="day-group__num">{{ $first->appointment_start->day }}</span>
            <h2 class="day-group__weekday h6 mb-0" id="day-{{ $loop->index }}">{{ $first->appointment_start->format('l') }}</h2>
            <span class="day-group__month">{{ $first->appointment_start->format('F, Y') }}</span>
            @if ($isToday)
                <span class="badge-soft badge-soft--today">Today</span>
            @endif
        </header>
        <ul class="appt-list">
            @foreach ($day as $appoint)
                <li class="appt">
                    <span class="appt__time">
                        <span class="visually-hidden">Time: </span>{{ $appoint->appointment_start->format('h:i A') }} &ndash; {{ $appoint->appointment_end->format('h:i A') }}
                    </span>
                    <span class="appt__who">
                        <a href="{{ route('admin.patient.view', $appoint->pet->id) }}">{{ $appoint->user->owner->full_name }} &ndash; {{ $appoint->pet->name }}</a>
                    </span>
                    <span class="appt__concern">
                        <strong>{{ $appoint->concern_name }}</strong>
                        @if ($appoint->reason)
                            <br>{{ $appoint->reason }}
                        @endif
                    </span>
                </li>
            @endforeach
        </ul>
    </section>
@empty
    <div class="card">
        @component('components.empty-state', [
            'title' => 'No upcoming appointments',
            'message' => 'Bookings made by clients will appear here.',
            'icon' => 'calendar-o',
        ])
            <a href="{{ route('admin.appointment.list') }}" class="btn btn-secondary">View appointment list</a>
        @endcomponent
    </div>
@endforelse
@endsection
