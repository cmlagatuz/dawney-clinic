@extends('layouts.admin')

@section('content')
<div class="card">
    <div class="card-header">Appointment Lists</div>
    <div class="card-body p-0">
        @if (session('status') || session('message'))
            <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger'}}">
                {{ session('message') }}
            </div>
        @endif
        <table class="table mb-0">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Client Name</th>
                    <th>Concern</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($appointments as $appointment)
                    <tr>
                        <td scope="row">{{ $appointment->appointment_start->format('M d Y') }}</td>
                        <td>{{ $appointment->user->owner->full_name }}</td>
                        <td>{{ $appointment->concern_name }}</td>
                        <td>{{ $appointment->appointment_start->format('h:i A') }}</td>
                        <td>{{ $appointment->appointment_end->format('h:i A') }}</td>
                        <td>
                            <a href="{{ route('admin.appointment.remind', $appointment->id) }}" class="btn btn-sm btn-secondary">
                                Remind
                            </a>
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>
</div>
@endsection
