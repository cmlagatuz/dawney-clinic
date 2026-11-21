@extends('layouts.app')

@section('content')
    <div class="card">
        <div class="card-header">Pets</div>
        <div class="card-body p-0">
            <table class="table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Gender</th>
                        <th>Species</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($pets as $pet)
                        <tr>
                            <td scope="row">{{ $pet->id }}</td>
                            <td scope="row">{{ $pet->name }}</td>
                            <td>{{ $pet->gender_name }}</td>
                            <td>{{ $pet->species_name }}</td>
                            <td>
                                <a href="{{ route('user.pet.view', $pet->id) }}" class="btn btn-sm btn-primary">
                                    View
                                </a>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    </div>
@endsection
