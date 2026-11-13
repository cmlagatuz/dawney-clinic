@extends('layouts.app')

@section('main')
<div class="cover">
    <div class="container h-100">
        <div class="row h-100 justify-content-center align-items-center">
            <div class="col-12">
                <div class="cover-bg text-center">
                    {{-- <img src="/images/dac-logo.png" class="logo" alt=""> --}}
                    <h1>Welcome to {{ config('app.name') }}</h1>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="container-fluid bg-grey">
    <div class="row">
        <div class="col-sm-4">
            <img src="/images/dac-logo.png" class="img-fluid ml-5" alt="">
        </div>
        <div class="col-sm-8">
            <div class="row h-100 justify-content-center align-items-center">
                <div class="col-12">
                    <h2>Our Values</h2><br>
                    <h4><strong>MISSION:</strong> Our mission it to help customers' pets live long, happy and healthy lives. We believe that a key element to a healthy pet is a great relationship with your veterinarian. Everyone at Dawney Animal Clinic is committed to professional, caring, personalized service. We takes our pride in our dedication to the highest standards in veterinary medicine. We have a full-service clinic offering state-of-the-art veterinary medical technology.
                    </h4><br>
                    <h4><strong>VISION:</strong> DAC aims to ensure that we are recognized by our offering of a full range medical services to the pets, and providing the highest standards in veterinary medicine.</h4>
                </div>
            </div>
        </div>
    </div>
</div>


    <style>
        .py-4{
            padding: 0 !important;
        }
        </style>


{{--
<div class="container">

        <div class="row justify-content-center">
            <div class="col-md-8">
                <div class="card">
                    <div class="card-header">TEST</div>

                    <div class="card-body">
                        TETS
                    </div>
                </div>
            </div>
        </div>
    </div> --}}
    @endsection
