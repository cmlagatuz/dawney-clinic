@extends('layouts.admin')

@section('content')

    @if (session('status') || session('message'))
        <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger'}}">
            {{ session('message') }}
        </div>
    @endif
    <div class="card mb-3">
        <div class="card-header">
            User Info - {{ $user->owner->full_name }}
        </div>
        <div class="card-body p-0">
            <div class="row">
                <div class="col-md-12">
                    <table class="table mb-0">
                        <tbody>
                            <tr>
                                <td scope="row" width="20%">ID:</td>
                                <td>{{ $user->id }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Last Name:</td>
                                <td>{{ $user->owner->last_name }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">First Name:</td>
                                <td>{{ $user->owner->first_name }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Email:</td>
                                <td>{{ $user->email }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Contact Number:</td>
                                <td>{{ $user->owner->contact_number }}</td>
                            </tr>
                            <tr>
                                <td scope="row" width="20%">Address:</td>
                                <td>{{ $user->owner->address }}</td>
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
                <a href="{{ route('admin.user.patient.create', $user->id) }}" class="btn btn-sm btn-success">Add New Pet</a>
            </div>
            <div class="pt-1">
                User Pets
            </div>
        </div>
        <div class="card-body p-0">
            <table class="table mb-0">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Pet Name</th>
                        <th>Species</th>
                        <th>Gender</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($user->owner->pets as $pet)
                        <tr>
                            <td>{{ $pet->id }}</td>
                            <td scope="row">{{ $pet->name }}</td>
                            <td>{{ $pet->species_name }}</td>
                            <td>{{ $pet->gender_name }}</td>
                            <td>
                                <a href="{{ route('admin.patient.view', $pet->id) }}" class="btn btn-sm btn-primary">
                                    View
                                </a>
                            </td>
                        </tr>
                    @endforeach
                    @if(count($user->owner->pets) == 0)
                        <tr>
                            <td colspan="3" class="text-center">No Record Found</td>
                        </tr>
                    @endif
                </tbody>
            </table>
        </div>
    </div>
    <div class="card mb-3">
        <div class="card-header">User Appointments</div>
        <div class="card-body p-0">
            <table class="table mb-0">
                <thead>
                    <tr>
                        <th>Appointment Start</th>
                        <th>Appointment End</th>
                        <th>Concern</th>
                        <th>Booked</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($user->appointments->sortBy('craeted_at') as $appointment)
                        <tr>
                            <td>{{ $appointment->appointment_start->format('M d Y @ h:i a') }}</td>
                            <td>{{ $appointment->appointment_end->format('M d Y @ h:i a') }}</td>
                            <td>{{ App\Appointment::CONCERN[$appointment->concern] }}</td>
                            <td>{{ $appointment->created_at->format('M d Y h:i a') }}</td>
                        </tr>
                    @endforeach
                    @if(count($user->appointments) == 0)
                        <tr>
                            <td colspan="3" class="text-center">No Record Found</td>
                        </tr>
                    @endif
                </tbody>
            </table>
        </div>
    </div>
@endsection
