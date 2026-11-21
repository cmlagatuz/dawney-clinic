@extends('layouts.app')

@section('content')
<div class="card">
    <div class="card-header">Appointment Details</div>
    <div class="card-body">
        <div class="row">
            <div class="col-md-6">
                <table class="table">
                    <thead>
                        <tr>
                            <th colspan="2" class="text-center">Pet Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td scope="row" width="20%">Name:</td>
                            <td>{{ $appointment->pet->name }}</td>
                        </tr>
                        <tr>
                            <td scope="row" width="20%">Color:</td>
                            <td>{{ $appointment->pet->color }}</td>
                        </tr>
                        <tr>
                            <td scope="row" width="20%">Gender:</td>
                            <td>{{ $appointment->pet->gender_name }}</td>
                        </tr>
                        <tr>
                            <td scope="row" width="20%">Species:</td>
                            <td>{{ $appointment->pet->species_name }}</td>
                        </tr>
                        <tr>
                            <td scope="row" width="20%">Breed:</td>
                            <td>{{ $appointment->pet->breed }}</td>
                        </tr>
                        <tr>
                            <td scope="row" width="20%">Birth Date:</td>
                            <td>{{ $appointment->pet->birth_date->format('M d Y') }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="col-md-6">
                <table class="table">
                    <thead>
                        <tr>
                            <th colspan="2" class="text-center">Owner Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td scope="row" width="30%">Name:</td>
                            <td>{{ $appointment->user->owner->full_name}}</td>
                        </tr>
                        <tr>
                            <td scope="row" width="30%">Contact Number:</td>
                            <td>{{ $appointment->user->owner->contact_number }}</td>
                        </tr>
                    </tbody>
                </table>
                <table class="table">
                    <thead>
                        <tr>
                            <th colspan="2" class="text-center">Schedule</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td scope="row" width="20%">Start Time:</td>
                            <td>{{ $appointment->appointment_start->format('M d Y @ h:i a') }}</td>
                        </tr>
                        <tr>
                            <td scope="row" width="20%">End Time:</td>
                            <td>{{ $appointment->appointment_end->format('M d Y @ h:i a') }}</td>
                        </tr>
                        <tr>
                            <td scope="row" width="20%">Concern:</td>
                            <td>{{ App\Appointment::CONCERN[$appointment->concern] }}</td>
                        </tr>
                        <tr>
                            <td scope="row" width="20%">Message:</td>
                            <td>{{ $appointment->reason }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
@endsection
