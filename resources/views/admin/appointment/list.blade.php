@extends('layouts.admin')

@section('title', 'Appointments')

@section('content')
@component('components.page-header', [
    'title' => 'Appointments',
    'subtitle' => 'Upcoming bookings, soonest first',
])
@endcomponent

@include('components.flash')

<div class="card">
    <div class="card-body p-0">
        <div class="filter-bar">
            <label for="appt-filter" class="mb-0 font-weight-bold">Filter</label>
            <input id="appt-filter" type="search" class="form-control form-control-sm" placeholder="Client, concern or date"
                   data-filter-input="#appt-table" data-filter-status="#appt-filter-status" autocomplete="off">
            <span class="filter-bar__count" id="appt-filter-status" role="status" aria-live="polite"></span>
        </div>
        <table class="table table-clinic table-hover table-stack mb-0" id="appt-table">
            <caption class="visually-hidden">Upcoming appointments</caption>
            <thead>
                <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Client Name</th>
                    <th scope="col">Concern</th>
                    <th scope="col">Start Time</th>
                    <th scope="col">End Time</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($appointments as $appointment)
                    <tr>
                        <td data-label="Date">{{ $appointment->appointment_start->format('M d Y') }}</td>
                        <td data-label="Client">{{ $appointment->user->owner->full_name }}</td>
                        <td data-label="Concern">{{ $appointment->concern_name }}</td>
                        <td data-label="Start">{{ $appointment->appointment_start->format('h:i A') }}</td>
                        <td data-label="End">{{ $appointment->appointment_end->format('h:i A') }}</td>
                    </tr>
                    {{-- The "Remind" action is deliberately NOT rendered: admin.appointment.remind is a GET route with a
                         paid-SMS (Nexmo) side effect. Re-add only after the lead moves it to an authorized POST + CSRF
                         or a free notification workflow. --}}
                @endforeach
                @if (count($appointments) == 0)
                    <tr data-filter-ignore>
                        <td colspan="5" class="cu-empty-cell">
                            @component('components.empty-state', [
                                'title' => 'No upcoming appointments',
                                'message' => 'Bookings made by clients will appear here.',
                                'icon' => 'calendar-o',
                            ])
                            @endcomponent
                        </td>
                    </tr>
                @endif
                <tr data-filter-ignore data-filter-nomatch hidden>
                    <td colspan="5" class="cu-empty-cell text-center text-muted py-4">No appointments on this page match your filter.</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<div class="mt-3 d-flex justify-content-center">
    {{ $appointments->links() }}
</div>
@endsection
