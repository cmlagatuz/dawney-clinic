@extends('layouts.app')

@section('content')
<div class="card">
    <div class="card-header">Appointments</div>
    <div class="card-body p-0">
        <table class="table">
            <thead>
                <tr>
                    <th>Pet Name</th>
                    <th>Appointment Start</th>
                    <th>Appointment End</th>
                    <th>Concern</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($appointments as $appointment)
                    <tr>
                        <td>{{ $appointment->pet->name }}</td>
                        <td>{{ $appointment->appointment_start->format('M d Y @ h:i a') }}</td>
                        <td>{{ $appointment->appointment_end->format('M d Y @ h:i a') }}</td>
                        <td>{{ App\Appointment::CONCERN[$appointment->concern] }}</td>
                        <td>
                            <a href="{{ route('user.appointment.view', $appointment->id) }}" class="btn btn-sm btn-primary">
                                View
                            </a>
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        {{ $appointments }}
    </div>
</div>
@endsection
