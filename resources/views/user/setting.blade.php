@extends('layouts.app')

@section('content')
<div class="card">
    <div class="card-header">
        Update Account
    </div>
    <div class="card-body">
        @if(session('slot') == 'info')
            @if (session('status') || session('message'))
                <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger'}}">
                    {{ session('message') }}
                </div>
            @endif
        @endif
        <form method="POST" action="{{ route('user.settings.changeinfo') }}" class="row" name="info">
            <div class="form-group col-md-6">
                <label for="">First Name</label>
                <input type="text" name="first_name" class="form-control @error('first_name') is-invalid @enderror" value="{{ $user->owner->first_name }}">
                @error('first_name')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            <div class="form-group col-md-6">
                <label for="">Last Name</label>
                <input type="text" name="last_name" class="form-control @error('last_name') is-invalid @enderror" value="{{ $user->owner->last_name }}">
                @error('last_name')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
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
                <input type="email" name="email" class="form-control @error('email') is-invalid @enderror" value="{{ $user->email }}" readonly>
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
                <button type="submt" class="btn btn-primary" name="info">Update</button>
            </div>
        </form>
    </div>
</div>

<div class="card mt-3">
    <div class="card-header">
        Update Password
    </div>
    <div class="card-body">
        @if(session('slot') == 'password')
            @if (session('status') || session('message'))
                <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger'}}">
                    {{ session('message') }}
                </div>
            @endif
        @endif
        <form method="POST" action="{{ route('user.settings.changePassword') }}" class="row" name="PASS">
            <div class="form-group col-md-12">
                <label for="">Current Password</label>
                <input type="password" name="current_password" class="form-control">
            </div>
            <div class="form-group col-md-12">
                <label for="">Last Name</label>
                <input type="password" name="password" class="form-control @error('password') is-invalid @enderror">
                @error('password')
                    <span class="invalid-feedback" role="alert">
                        <strong>{{ $message }}</strong>
                    </span>
                @enderror
            </div>
            <div class="form-group col-md-12">
                <label for="">Confirm Password</label>
                <input type="password" name="password_confirmation" class="form-control">
            </div>
            <div class="form-group col-md-12">
                @csrf
                <button class="btn btn-primary">Update</button>
            </div>
        </form>
    </div>
</div>
@endsection
