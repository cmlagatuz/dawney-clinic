@extends('layouts.admin')

@section('content')

    @if (session('status') || session('message'))
        <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger'}}">
            {{ session('message') }}
        </div>
    @endif
    <div class="card mb-3">
        <div class="card-header">
            Patient Info - {{ $patient->name }}
        </div>
        <div class="card-body p-0">
            <div class="row">
                <div class="col-md-12">
                    <table class="table mb-0">
                        <tbody>
                            <tr>
                                <td scope="row" width="20%">ID:</td>
                                <td>{{ $patient->id }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Name:</td>
                                <td>{{ $patient->name }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Color:</td>
                                <td>{{ $patient->color }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Gender:</td>
                                <td>{{ $patient->gender_name }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Species:</td>
                                <td>{{ $patient->species_name }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Breed:</td>
                                <td>{{ $patient->breed }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Birth Date:</td>
                                <td>{{ $patient->birth_date->toDateString() }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Owner:</td>
                                <td>{{ $patient->owner->full_name }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
    <div class="card mb-3">
        <div class="card-header">
            <div class="float-right">
                <a href="{{ route('admin.patient.record.create', $patient->id) }}" class="btn btn-sm btn-success">Add New Record</a>
            </div>
            <div class="pt-1">
                Patient History
            </div>
        </div>
        <div class="card-body p-0">
            <table class="table mb-0">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Procedure</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($patient->records as $record)
                        <tr>
                            <td scope="row">{{ $record->created_at->format('M d Y') }}</td>
                            <td>{{ $record->procedure }}</td>
                            <td>
                                <a href="{{ route('admin.patient.record.view',[
                                    'id' => $patient->id,
                                    'rId' => $record->id
                                ]) }}" class="btn btn-sm btn-primary">
                                    View
                                </a>
                            </td>
                        </tr>
                    @endforeach
                    @if(count($patient->records) == 0)
                        <tr>
                            <td colspan="3" class="text-center">No Record Found</td>
                        </tr>
                    @endif
                </tbody>
            </table>
        </div>
    </div>
    <div class="card mb-3">
        <div class="card-header">Patient Appointments</div>
        <div class="card-body p-0">
            <table class="table mb-0">
                <thead>
                    <tr>
                        <th>Appointment Start</th>
                        <th>Appointment End</th>
                        <th>Booked</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($patient->appointments->sortBy('craeted_at') as $appointment)
                        <tr>
                            <td>{{ $appointment->appointment_start->format('M d Y @ h:i a') }}</td>
                            <td>{{ $appointment->appointment_end->format('M d Y @ h:i a') }}</td>
                            <td>{{ $appointment->created_at->format('M d Y h:i a') }}</td>
                        </tr>
                    @endforeach
                    @if(count($patient->appointments) == 0)
                        <tr>
                            <td colspan="3" class="text-center">No Record Found</td>
                        </tr>
                    @endif
                </tbody>
            </table>
        </div>
    </div>
@endsection
