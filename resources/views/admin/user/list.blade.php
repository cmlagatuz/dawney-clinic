@extends('layouts.admin')

@section('content')

<div class="card">
    <div class="card-header">
        Users
    </div>
    <div class="card-body p-0">
        <table class="table mb-0">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Created</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                @foreach($users as $user)
                <tr>
                    <td scope="row">{{ $user->owner->full_name }}</td>
                    <td>{{ $user->email }}</td>
                    <td>{{ $user->created_at->toDateTimeString() }}</td>
                    <td>
                        <a href="{{ route('admin.user.view', $user->id) }}" class="btn btn-sm btn-secondary">View</a>
                        <a href="{{ route('admin.user.update', $user->id) }}" class="btn btn-sm btn-primary">Update</a>
                        <a href="{{ route('admin.user.patient.create', $user->id) }}" class="btn btn-sm btn-success">Add Patient</a>
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
        {{ $users }}
    </div>
</div>

@endsection
