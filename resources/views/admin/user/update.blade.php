@extends('layouts.admin')

@section('content')
<div class="card">
    <div class="card-header">
        Update User {{ $user->owner->full_name }}
    </div>
    <div class="card-body">
        @if (session('status') || session('message'))
            <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger'}}">
                {{ session('message') }}
            </div>
        @endif
        <form method="POST" class="row">
            <div class="form-group col-md-4">
                <label for="">First Name</label>
                <input type="text" name="first_name" class="form-control @error('first_name') is-invalid @enderror" value="{{ $user->owner->first_name }}">
                @error('first_name')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            <div class="form-group col-md-4">
                <label for="">Last Name</label>
                <input type="text" name="last_name" class="form-control @error('last_name') is-invalid @enderror" value="{{ $user->owner->last_name }}">
                @error('last_name')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            @if($user->id != 1)
            <div class="form-group col-md-4">
                <label for="">-</label>
                <div class="form-check mt-2 @error('last_name') is-invalid @enderror">
                    <label class="form-check-label">
                        <input class="form-check-input" type="checkbox" name="is_admin" value="true" {{ $user->is_admin ? 'checked' : ''}}> Is Admin?
                    </label>
                </div>
                @error('last_name')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            @endif
            <div class="form-group col-md-6">
                <label for="">Contact Number</label>
                <input type="text" name="contact_number" class="form-control @error('contact_number') is-invalid @enderror" value="{{ $user->owner->contact_number }}">
                @error('contact_number')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            <div class="form-group col-md-6">
                <label for="">Email</label>
                <input type="email" name="email" class="form-control @error('email') is-invalid @enderror" value="{{ $user->email }}">
                @error('email')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            <div class="form-group col-md-12">
                <label for="">Address</label>
                <input type="text" name="address" class="form-control @error('address') is-invalid @enderror" value="{{ $user->owner->address }}">
                @error('address')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            <div class="form-group col-md-12">
                @csrf
                <button class="btn btn-primary">Update</button>
            </div>
        </form>
    </div>
</div>
@endsection
