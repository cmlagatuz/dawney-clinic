@extends('layouts.admin')

@section('title', $patient->name)

@section('content')
@component('components.page-header', [
    'title' => $patient->name,
    'subtitle' => $patient->species_name . ' · Owner: ' . $patient->owner->full_name,
])
    @slot('actions')
        <a href="{{ route('admin.patient.update', $patient->id) }}" class="btn btn-secondary">Update</a>
        <a href="{{ route('admin.patient.record.create', $patient->id) }}" class="btn btn-primary">Add New Record</a>
    @endslot
@endcomponent

@include('components.flash')

<div class="card mb-4">
    <h2 class="card-header h6 mb-0">Patient Info</h2>
    <dl class="facts">
        <div><dt>ID</dt><dd>{{ $patient->id }}</dd></div>
        <div><dt>Name</dt><dd>{{ $patient->name }}</dd></div>
        <div><dt>Species</dt><dd>{{ $patient->species_name }}</dd></div>
        <div><dt>Breed</dt><dd>{{ $patient->breed }}</dd></div>
        <div><dt>Gender</dt><dd>{{ $patient->gender_name }}</dd></div>
        <div><dt>Color</dt><dd>{{ $patient->color }}</dd></div>
        <div><dt>Birth Date</dt><dd>{{ $patient->birth_date->toDateString() }}</dd></div>
        <div><dt>Owner</dt><dd>{{ $patient->owner->full_name }}</dd></div>
    </dl>
</div>

<div class="card mb-4">
    <h2 class="card-header h6 mb-0">Patient History</h2>
    <div class="card-body p-0">
        <table class="table table-clinic table-hover table-stack mb-0">
            <caption class="visually-hidden">Medical records for {{ $patient->name }}</caption>
            <thead>
                <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Procedure</th>
                    <th scope="col"><span class="visually-hidden">Action</span></th>
                </tr>
            </thead>
            <tbody>
                @foreach ($patient->records as $record)
                    <tr>
                        <td data-label="Date">{{ $record->created_at->format('M d Y') }}</td>
                        <td data-label="Procedure">{{ $record->procedure }}</td>
                        <td>
                            <a href="{{ route('admin.patient.record.view', [
                                'id' => $patient->id,
                                'rId' => $record->id
                            ]) }}" class="btn btn-sm btn-primary"
                               aria-label="View record: {{ $record->procedure }}, {{ $record->created_at->format('M d Y') }}">
                                View
                            </a>
                        </td>
                    </tr>
                @endforeach
                @if (count($patient->records) == 0)
                    <tr>
                        <td colspan="3" class="cu-empty-cell">
                            @component('components.empty-state', [
                                'title' => 'No records yet',
                                'message' => 'Clinical notes for ' . $patient->name . ' will appear here.',
                                'icon' => 'file-text-o',
                            ])
                                <a href="{{ route('admin.patient.record.create', $patient->id) }}" class="btn btn-primary">Add New Record</a>
                            @endcomponent
                        </td>
                    </tr>
                @endif
            </tbody>
        </table>
    </div>
</div>

<div class="card mb-4">
    <h2 class="card-header h6 mb-0">Patient Appointments</h2>
    <div class="card-body p-0">
        <table class="table table-clinic table-stack mb-0">
            <caption class="visually-hidden">Appointments for {{ $patient->name }}</caption>
            <thead>
                <tr>
                    <th scope="col">Appointment Start</th>
                    <th scope="col">Appointment End</th>
                    <th scope="col">Booked</th>
                </tr>
            </thead>
            <tbody>
                {{-- Was sortBy('craeted_at') (typo, so it never sorted); now orders by booking time as intended. --}}
                @foreach ($patient->appointments->sortBy('created_at') as $appointment)
                    <tr>
                        <td data-label="Start">{{ $appointment->appointment_start->format('M d Y @ h:i a') }}</td>
                        <td data-label="End">{{ $appointment->appointment_end->format('M d Y @ h:i a') }}</td>
                        <td data-label="Booked">{{ $appointment->created_at->format('M d Y h:i a') }}</td>
                    </tr>
                @endforeach
                @if (count($patient->appointments) == 0)
                    <tr>
                        <td colspan="3" class="cu-empty-cell">
                            @component('components.empty-state', [
                                'title' => 'No appointments',
                                'icon' => 'calendar-o',
                            ])
                            @endcomponent
                        </td>
                    </tr>
                @endif
            </tbody>
        </table>
    </div>
</div>
@endsection
