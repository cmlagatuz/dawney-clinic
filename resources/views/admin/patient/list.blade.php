@extends('layouts.admin')

@section('title', 'Patients')

@section('content')
@component('components.page-header', [
    'title' => 'Patients',
    'subtitle' => $pets->total() . ' registered',
])
    @slot('actions')
        <a href="{{ route('admin.patient.create') }}" class="btn btn-primary">Add Client</a>
    @endslot
@endcomponent

@include('components.flash')

<div class="card">
    <div class="card-body p-0">
        <div class="filter-bar">
            <label for="patient-filter" class="mb-0 font-weight-bold">Filter</label>
            <input id="patient-filter" type="search" class="form-control form-control-sm" placeholder="Name, owner, species&hellip;"
                   data-filter-input="#patient-table" data-filter-status="#patient-filter-status" autocomplete="off">
            <span class="filter-bar__count" id="patient-filter-status" role="status" aria-live="polite"></span>
        </div>
        <table class="table table-clinic table-hover table-stack mb-0" id="patient-table">
            <caption class="visually-hidden">Registered patients</caption>
            <thead>
                <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Pet Name</th>
                    <th scope="col">Owner</th>
                    <th scope="col">Species</th>
                    <th scope="col">Gender</th>
                    <th scope="col"><span class="visually-hidden">Actions</span></th>
                </tr>
            </thead>
            <tbody>
                @foreach ($pets as $pet)
                    <tr>
                        <td data-label="ID">{{ $pet->id }}</td>
                        <td data-label="Pet" class="font-weight-bold">{{ $pet->name }}</td>
                        <td data-label="Owner">{{ $pet->owner->full_name }}</td>
                        <td data-label="Species"><span class="badge-soft">{{ $pet->species_name }}</span></td>
                        <td data-label="Gender">{{ $pet->gender_name }}</td>
                        <td>
                            <div class="row-actions">
                                <a href="{{ route('admin.patient.view', $pet->id) }}" class="btn btn-sm btn-secondary" aria-label="View {{ $pet->name }}">View</a>
                                <a href="{{ route('admin.patient.update', $pet->id) }}" class="btn btn-sm btn-primary" aria-label="Update {{ $pet->name }}">Update</a>
                            </div>
                        </td>
                    </tr>
                @endforeach
                @if (count($pets) == 0)
                    <tr data-filter-ignore>
                        <td colspan="6" class="cu-empty-cell">
                            @component('components.empty-state', [
                                'title' => 'No patients yet',
                                'message' => 'Add a client and their pet to get started.',
                            ])
                                <a href="{{ route('admin.patient.create') }}" class="btn btn-primary">Add Client</a>
                            @endcomponent
                        </td>
                    </tr>
                @endif
                <tr data-filter-ignore data-filter-nomatch hidden>
                    <td colspan="6" class="cu-empty-cell text-center text-muted py-4">No patients on this page match your filter.</td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

{{-- The controller paginates (20/page); the legacy view never rendered page links, hiding patients beyond page 1. --}}
<div class="mt-3 d-flex justify-content-center">
    {{ $pets->links() }}
</div>
@endsection
