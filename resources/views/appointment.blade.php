@extends('layouts.app')

@section('content')
    <div class="row justify-content-center py-4">
        <div class="col-md-8">
            <div class="card">
                <div class="card-header">Schedule an Appointment</div>

                <div class="card-body">
                    @if (session('status') || session('message'))
                        <div class="alert {{ session('status') ? 'alert-success' : 'alert-danger'}}">
                            {{ session('message') }}
                        </div>
                    @endif
                    <form action="{{ route('appointment.store') }}" method="POST" class="row" autocomplete="off">
                        <div class="form-group col-md-12">
                            Pet Information
                        </div>
                        <div class="col-md-12">
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <a href="Javascript::void()" id="selectPetBtn" class="btn btn-block btn-primary">Select Existing Pet</a>
                                </div>
                                <div class="col-md-6">
                                    <a href="Javascript::void()" id="newPetBtn" class="btn btn-block btn-primary">Add New Pet</a>
                                </div>
                            </div>
                            <div class="row d-none" id="selectPet">
                                <div class="form-group col-md-12">
                                    <label for="">Pets</label>
                                    <select name="pet_id" class="form-control @error('pet_id') is-invalid @enderror">
                                        <option value="">Select Pet</option>
                                        @foreach($pets as $pet)
                                            <option value="{{ $pet->id }}">{{ $pet->name }}</option>
                                        @endforeach
                                    </select>
                                    @error('pet_id')
                                        <span class="invalid-feedback" role="alert">
                                            <strong>{{ $message }}</strong>
                                        </span>
                                    @enderror
                                </div>
                            </div>
                            <div class="row d-none" id="newPet">
                                <div class="form-group col-md-12">
                                    <label for="">Name</label>
                                    <input type="text" name="name" class="form-control @error('name') is-invalid @enderror" value="{{ old('name') }}">
                                    @error('name')
                                        <span class="invalid-feedback" role="alert">
                                            <strong>{{ $message }}</strong>
                                        </span>
                                    @enderror
                                </div>
                                <div class="form-group col-md-3">
                                    <label for="">Gender</label>
                                    <select name="gender" class="form-control @error('gender') is-invalid @enderror">
                                        <option value="1">Male</option>
                                        <option value="2">Female</option>
                                    </select>
                                    @error('gender')
                                        <span class="invalid-feedback" role="alert">
                                            <strong>{{ $message }}</strong>
                                        </span>
                                    @enderror
                                </div>
                                <div class="form-group col-md-3">
                                    <label for="">Breed</label>
                                    <input type="text" name="breed" class="form-control @error('breed') is-invalid @enderror" value="{{ old('breed') }}">
                                    @error('breed')
                                        <span class="invalid-feedback" role="alert">
                                            <strong>{{ $message }}</strong>
                                        </span>
                                    @enderror
                                </div>
                                <div class="form-group col-md-6">
                                    <label for="">Color</label>
                                    <input type="text" name="color" class="form-control @error('color') is-invalid @enderror" value="{{ old('name') }}">
                                    @error('color')
                                        <span class="invalid-feedback" role="alert">
                                            <strong>{{ $message }}</strong>
                                        </span>
                                    @enderror
                                </div>
                                <div class="form-group col-md-6">
                                    <label for="">Species</label>
                                    <select name="species" class="form-control @error('species') is-invalid @enderror">
                                        @foreach (App\Pet::SPECIES as $species)
                                            <option value="{{ $loop->iteration }}">{{ $species }}</option>
                                        @endforeach
                                    </select>
                                    @error('species')
                                        <span class="invalid-feedback" role="alert">
                                            <strong>{{ $message }}</strong>
                                        </span>
                                    @enderror
                                </div>
                                <div class="form-group col-md-6">
                                    <label for="">Date of Birth</label>
                                    <div class="input-group date" id="dateOnly" data-target-input="nearest">
                                        <input type="text" name="date_birth" class="form-control @error('date_birth') is-invalid @enderror datetimepicker-input" data-target="#dateOnly"/>
                                        <div class="input-group-append" data-target="#dateOnly" data-toggle="datetimepicker">
                                            <div class="input-group-text"><i class="fa fa-calendar"></i></div>
                                        </div>

                                        @error('date_birth')
                                            <span class="invalid-feedback" role="alert">
                                                <strong>{{ $message }}</strong>
                                            </span>
                                        @enderror
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="form-group col-md-12">
                            <hr>
                        </div>
                        <div class="form-group col-md-12">
                            <label for="">Concern</label>
                            <select name="concern" class="form-control @error('concern') is-invalid @enderror">
                                <option value="">Select Concern</option>
                                @foreach(App\Appointment::CONCERN as $concern)
                                    <option value="{{ $loop->iteration }}">{{ $concern }}</option>
                                @endforeach
                                <option value="10" {{ old('concern') == 10 ? 'selected' : ''}}>Others</option>
                            </select>
                            @error('concern')
                                <span class="invalid-feedback" role="alert">
                                    <strong>{{ $message }}</strong>
                                </span>
                            @enderror
                        </div>
                        <div class="form-group col-md-12 d-none" id="concernOthers">
                            <label for="">Other Concern?</label>
                            <input type="text" name="concern_others" class="form-control @error('concern_others') is-invalid @enderror">
                            @error('concern_others')
                                <span class="invalid-feedback" role="alert">
                                    <strong>{{ $message }}</strong>
                                </span>
                            @enderror
                        </div>
                        <div class="form-group col-md-6">
                            <label for="">Appointment Time</label>
                            <div class="input-group date" id="datetimepicker1" data-target-input="nearest">
                                <input type="text" name="appointment_time" class="form-control @error('appointment_time') is-invalid @enderror datetimepicker-input" data-target="#datetimepicker1">
                                <div class="input-group-append" data-target="#datetimepicker1" data-toggle="datetimepicker">
                                    <div class="input-group-text"><i class="fa fa-calendar"></i></div>
                                </div>
                                @error('appointment_time')
                                    <span class="invalid-feedback" role="alert">
                                        <strong>{{ $message }}</strong>
                                    </span>
                                @enderror
                            </div>
                        </div>
                        <div class="form-group col-md-6">
                            <label for="">Time Available</label>
                            <div class="times row">

                            </div>
                        </div>
                        <div class="form-group col-md-12">
                            <label for="">Message</label>
                            <textarea name="message" class="form-control @error('message') is-invalid @enderror"></textarea>
                            @error('message')
                                <span class="invalid-feedback" role="alert">
                                    <strong>{{ $message }}</strong>
                                </span>
                            @enderror
                        </div>
                        <div class="form-group col-md-12">
                            <hr>
                            <i class="form-text text-muted">For surgery or emergency cases please visit to our clinic immediately</i>
                        </div>
                        <div class="form-group col-md-12">
                            @csrf
                            <button class="btn btn-primary">Submit</button>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection

@section('script')
    <script>

        $('select[name="concern"]').change(function(e){
            if($(this).val() == 10){
                $('#concernOthers').removeClass('d-none')
            }else{
                $('#concernOthers').addClass('d-none')
            }
        })

        $(document).ready(function() {
            if($('select[name="concern"]').val() == 10){
                $('#concernOthers').removeClass('d-none')
            }
        });

        $('#datetimepicker1').datetimepicker({
            minDate: new Date().toDateString(),
            daysOfWeekDisabled : [0],
            format: 'L',
        });
        $('#dateOnly').datetimepicker({
            maxDate: new Date().toDateString(),
            format: 'L',
        });

        $.get('/check', {
            date: new Date().toDateString()
        }, function(data){
            data.hours.forEach((element, index) => {
                var radio = '<div class="radio col-md-6">'
                    + '<label ' + (element[2] === 'taken' || element[2] === 'notavail' || element[3] === 'taken' || element[3] === 'notavail' ? 'class="text-danger"' : 'class="text-success"') + '><input type="radio" name="hour" value="' + index + '" ' + (element[2] === 'taken' || element[2] === 'notavail' || element[3] === 'taken' || element[3] === 'notavail' ? 'disabled class="text-danger"' : '') + ' required> ' +element[0] + ' - ' + element[1] + '</label>'
                    + '</div>';

                $('.times').append(radio);
            });
        })

        $('#datetimepicker1').on('change.datetimepicker', function(e){
            var date = e.date.month() + 1 + "/" +e.date.date() + "/" + e.date.year()
            $('.times').html('');
            $.get('/check', {
                date: date
            }, function(data){
                console.log(data);
                data.hours.forEach((element, index) => {
                    // $('.times').append('<input type="radio" name="hour" value="' + index + '" '+ (element[2] === 'taken' ? 'disabled' : '') +'> ' +element[0] + ' - ' + element[1])

                    var radio = '<div class="radio col-md-6">'
                        + '<label ' + (element[2] === 'taken' || element[2] === 'notavail' || element[3] === 'taken' || element[3] === 'notavail' ? 'class="text-danger"' : 'class="text-success"') + '><input type="radio" name="hour" value="' + index + '" ' + (element[2] === 'taken' || element[2] === 'notavail' || element[3] === 'taken' || element[3] === 'notavail' ? 'disabled class="text-danger"' : '') + ' required> ' +element[0] + ' - ' + element[1] + '</label>'
                        + '</div>';

                    $('.times').append(radio);
                });
            })
        })
        $('#selectPetBtn').click(function(){
            $('#selectPet').removeClass('d-none');
            $('#newPet').addClass('d-none');
            $('input[name="name"]').val('');
            $('select[name="gender"]').val('');
            $('input[name="breed"]').val('');
            $('input[name="color"]').val('');
            $('select[name="species"]').val('');
            $('input[name="date_birth"]').val('');
            window.location.hash = '#pet'
        })
        $('#newPetBtn').click(function(){
            $('#newPet').removeClass('d-none');
            $('#selectPet').addClass('d-none');
            window.location.hash = '#new'
        })

        if(window.location.hash == '#new'){
            $('#newPet').removeClass('d-none');
        }else if(window.location.hash == '#pet'){
            $('#selectPet').removeClass('d-none');
        }
    </script>
@endsection
