<?php

namespace App\Http\Controllers;

use App\Appointment;
use App\Pet;
use Carbon\Carbon;
use Nexmo\Laravel\Facade\Nexmo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AppointmentController extends Controller{

    public function create(){
        $user = auth()->user();
        $pets = Pet::where('owner_id', $user->owner->id)->get();

        return view('appointment', compact('pets'));
    }

    public function store(Request $request){
        $user = $request->user();
        $owner = $user->owner;

        if (!$owner) {
            abort(403);
        }

        // $request->validate([
        //     'pet_id' => 'required_without:name,gender,color,breed,species,date_birth',
        //     'name' => ['required_without:pet_id'],
        //     'gender' => 'required_without:pet_id',
        //     'color' => 'required_without:pet_id',
        //     'breed' => 'required_without:pet_id',
        //     'species' => 'required_without:pet_id',
        //     'date_birth' => ['required_without:pet_id', 'nullable', 'date'],
        //     'appointment_time' => 'required|date',
        //     'message' => 'nullable',
        // ]);

        $validator = Validator::make($request->all(), [
            'pet_id' => ['required_without:name,gender,color,breed,species,date_birth', 'nullable', 'integer', Rule::exists('pets', 'id')->where('owner_id', $owner->id)],
            'name' => ['required_without:pet_id'],
            'gender' => 'required_without:pet_id',
            'color' => 'required_without:pet_id',
            'breed' => 'required_without:pet_id',
            'species' => 'required_without:pet_id',
            'date_birth' => ['required_without:pet_id', 'nullable', 'date'],
            'appointment_time' => 'required|date',
            'concern' => ['required', Rule::in([1, 2, 3, 4, 5, 10])],
            'concern_others' => Rule::requiredIf(function () use ($request) {
                return $request->concern == 10;
            }),
            'message' => 'nullable',
            'hour' => 'required|integer|between:0,15'
        ]);

        if ($validator->fails()) {
            return redirect()->route('appointment.create', ['', $request->pet_id ? '#pet' : '#new'])
                        ->withErrors($validator)
                        ->withInput();
        }

        $hours = [
            ['8:00', '8:30'],
            ['8:30', '9:00'],
            ['9:00', '9:30'],
            ['9:30', '10:00'],
            ['10:00', '10:30'],
            ['10:30', '11:00'],
            ['11:00', '11:30'],
            ['11:30', '12:00'],
            // ['12:00', '12:30'],
            // ['12:30', '13:00'],
            ['13:00', '13:30'],
            ['13:30', '14:00'],
            ['14:00', '14:30'],
            ['14:30', '15:00'],
            ['15:00', '15:30'],
            ['15:30', '16:00'],
            ['16:00', '16:30'],
            ['16:30', '17:00'],
        ];

        $start_time = Carbon::parse($request->appointment_time . ' ' . $hours[$request->hour][0]);
        $end_time = Carbon::parse($request->appointment_time . ' ' . $hours[$request->hour][1]);

        if($start_time->lt(Carbon::now())){
            return redirect()->route('appointment.create', ['', $request->pet_id ? '#pet' : '#new'])->with([
                'status' => false,
                'message' => 'Schedule is not Available'
            ]);
        }

        // $check = Appointment::whereDate('appointment_start', '=', $start_time)->whereTime('appointment_end', '>=', $start_time->toTimeString())
        //     ->whereTime('appointment_start', '<=', $end_time->toTimeString())
        //     ->first();

        // if($check){
        //     return redirect()->route('appointment.create')->with([
        //         'status' => false,
        //         'message' => 'Conflicts with another appointment please adjust the time. Thanks'
        //     ]);
        // }

        $weekMap = [
            1 => 'MO',
            2 => 'TU',
            3 => 'WE',
            4 => 'TH',
            5 => 'FR',
            6 => 'SA',
        ];


        if(!in_array($start_time->dayOfWeek, array_keys($weekMap))){
            return redirect()->route('appointment.create')->with([
                'status' => false,
                'message' => 'The clinic is closed in sunday please choose other day'
            ]);
        }

        // if(!($start_time->hour >= 8 && $start_time->hour <= 17)){
        //     return redirect()->route('appointment.create')->with([
        //         'status' => false,
        //         'message' => 'The clinic is open at 8AM to 5PM'
        //     ]);
        // }

        if($request->pet_id){
            $pet = Pet::where('owner_id', $owner->id)->findOrFail($request->pet_id);
        }else{
            $pet = Pet::create([
                'owner_id' => $user->owner->id,
                'name' => $request->name,
                'gender' => $request->gender,
                'breed' => $request->breed,
                'color' => $request->color,
                'species' => $request->species,
                'birth_date' => Carbon::parse($request->date_birth),
            ]);
        }

        Appointment::create([
            'user_id' => $user->id,
            'pet_id' => $pet->id,
            'appointment_start' => $start_time,
            'appointment_end' => $end_time,
            'reason' => $request->message,
            'concern' => $request->concern == 10 ? $request->concern_others : ($request->concern - 1)
        ]);

        $number = $user->owner->contact_number;

        $number = substr($number, 1);

        $number = '63'. $number;

        Nexmo::message()->send([
            'to'   => $number,
            'from' => '639999385515',
            'text' => 'You have successfully booked your appointment in Dawney Animal Clinic at '. $start_time->format('h:i a') . ' ' . $start_time->toDateString()
        ]);

        return redirect()->route('appointment.create')->with([
            'status' => true,
            'message' => 'Your appointment has been booked!'
        ]);

    }

    public function checkDate(Request $request){
        $date = $request->date;
        $carbonDate = Carbon::parse($date);

        $hours = [
            ['8:00', '8:30'],
            ['8:30', '9:00'],
            ['9:00', '9:30'],
            ['9:30', '10:00'],
            ['10:00', '10:30'],
            ['10:30', '11:00'],
            ['11:00', '11:30'],
            ['11:30', '12:00'],
            // ['12:00', '12:30'],
            // ['12:30', '13:00'],
            ['13:00', '13:30'],
            ['13:30', '14:00'],
            ['14:00', '14:30'],
            ['14:30', '15:00'],
            ['15:00', '15:30'],
            ['15:30', '16:00'],
            ['16:00', '16:30'],
            ['16:30', '17:00'],
        ];

        foreach($hours as $key => $hour){

            $start = Carbon::parse($date . ' ' . $hour[0]);

            if($start->lt(Carbon::now())){
                array_push($hours[$key], 'notavail');
            }


            $check = Appointment::whereDate('appointment_start', '=', $carbonDate)->whereTime('appointment_end', '>=', Carbon::parse($date . ' ' . $hour[1])->toTimeString())
                ->whereTime('appointment_start', '<=', Carbon::parse($date . ' ' . $hour[0])->toTimeString())
                ->first();

            if($check){
                array_push($hours[$key], 'taken');
            }
        }

        return response()->json([
            'status' => true,
            'hours' => $hours,
        ]);

    }

}
