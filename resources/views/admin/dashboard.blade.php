@extends('layouts.admin')


@section('content')
<div class="card">
    <div class="card-header">
        Appointments
    </div>
    <div class="card-body p-0">
        <div class="table-responsive agenda">
            <table class="table table-condensed table-bordered mb-0">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Appointment</th>
                        <th>Concern</th>
                        <th>Message</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Single event in a single day -->
                    @foreach ($appointments as $appointment)

                        <tr class="{{ $appointment[0]->appointment_start->format('Y-m-d') == Carbon\Carbon::now()->format('Y-m-d') ? 'table-success' : '' }}">
                            <td class="agenda-date" class="active" rowspan="{{ count($appointment) }}">
                                <div class="dayofmonth">{{ $appointment[0]->appointment_start->day }}</div>
                                <div class="dayofweek">{{ $appointment[0]->appointment_start->format('l') }}</div>
                                <div class="shortdate text-muted">{{ $appointment[0]->appointment_start->format('F, Y') }}</div>
                            </td>
                            @php
                                $first = $appointment->first();
                            @endphp
                            <td class="agenda-time">
                                {{ $first->appointment_start->format('h:i A') }} - {{ $first->appointment_end->format('h:i A') }}
                            </td>

                            <td class="agenda-events">
                                <div class="agenda-event">
                                    <a href="{{ route('admin.patient.view', $first->pet->id) }}">{{ $first->user->owner->full_name }} - {{ $first->pet->name }}</a>
                                </div>
                            </td>
                            <td class="agenda-message">
                                {{ $first->concern_name }}
                            </td>
                            <td class="agenda-message">
                                {{ $first->reason ?? '-' }}
                            </td>
                        </tr>
                        @foreach ($appointment as $key => $appoint)
                            @if($key != 0)
                                <tr class="{{ $appoint->appointment_start->format('Y-m-d') == Carbon\Carbon::now()->format('Y-m-d') ? 'table-success' : '' }}">
                                    <td class="agenda-time">
                                        {{ $appoint->appointment_start->format('h:i A') }} - {{ $appoint->appointment_end->format('h:i A') }}
                                    </td>
                                    <td class="agenda-events">
                                        <div class="agenda-event">
                                        <a href="{{ route('admin.patient.view', $appoint->pet->id) }}">{{ $appoint->user->owner->full_name }} - {{ $appoint->pet->name }}</a>
                                        </div>
                                    </td>
                                    <td class="agenda-message">
                                        {{ $appoint->concern_name }}
                                    </td>
                                    <td class="agenda-message">
                                        {{ $first->reason }}
                                    </td>
                                </tr>
                            @endif
                        @endforeach

                    @endforeach

                    <!-- Multiple events in a single day (note the rowspan) -->
                    {{-- <tr>
                        <td class="agenda-date" class="active" rowspan="3">
                            <div class="dayofmonth">24</div>
                            <div class="dayofweek">Thursday</div>
                            <div class="shortdate text-muted">July, 2014</div>
                        </td>
                        <td class="agenda-time">
                            8:00 - 9:00 AM
                        </td>
                        <td class="agenda-events">
                            <div class="agenda-event">
                                Doctor's Appointment
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="agenda-time">
                            10:15 AM - 12:00 PM
                        </td>
                        <td class="agenda-events">
                            <div class="agenda-event">
                                Meeting with executives
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="agenda-time">
                            7:00 - 9:00 PM
                        </td>
                        <td class="agenda-events">
                            <div class="agenda-event">
                                Aria's dance recital
                            </div>
                        </td>
                    </tr> --}}
                </tbody>
            </table>
        </div>
    </div>
</div>

@endsection
