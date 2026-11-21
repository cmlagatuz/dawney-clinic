@extends('layouts.admin')

@section('content')
    <div class="card">
        <div class="card-header">
            <div class="float-right">
                <a href="{{ route('admin.patient.create') }}" class="btn btn-sm btn-success">Add Client</a>
            </div>
            <div class="pt-1">
                Patient List
            </div>
        </div>

        <div class="card-body p-0">
            <table class="table mb-0">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Pet Name</th>
                        <th>Owner</th>
                        <th>Species</th>
                        <th>Gender</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($pets as $pet)
                        <tr>
                            <td scope="row">{{ $pet->id }}</td>
                            <td scope="row">{{ $pet->name }}</td>
                            <td scope="row">{{ $pet->owner->full_name }}</td>
                            <td>{{ $pet->species_name }}</td>
                            <td>{{ $pet->gender_name }}</td>
                            <td>
                                <a href="{{ route('admin.patient.view', $pet->id) }}" class="btn btn-sm btn-secondary">
                                    View
                                </a>
                                <a href="{{ route('admin.patient.update', $pet->id) }}" class="btn btn-sm btn-primary">
                                    Update
                                </a>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>
@endsection
