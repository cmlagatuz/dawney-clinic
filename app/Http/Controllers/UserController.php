<?php

namespace App\Http\Controllers;

use App\Appointment;
use App\Pet;
use App\PetRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller{

    public function setting(){
        $user = auth()->user();

        return view('user.setting', compact('user'));
    }

    public function changeInfo(Request $request){
        $user = $request->user();
        $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'contact_number' => ['required', 'string', 'max:11', 'regex:/^(09)\d{9}$/'],
            'address' => ['required', 'string', 'max:255'],
        ]);

        $user->owner->update([
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'contact_number' => $request->contact_number,
            'address' => $request->address
        ]);

        return redirect()->route('user.settings')->with([
            'status' => true,
            'message' => 'Successfully updated',
            'slot' => 'info'
        ]);
    }

    public function changePassword(Request $request){
        $request->validate([
            'current_password' => 'required',
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = $request->user();

        if(!Hash::check($request->current_password, $user->password)){
            return redirect()->route('user.settings')->with([
                'status' => false,
                'message' => 'Your current password is incorrect',
                'slot' => 'password'
            ]);
        }

        $user->update([
            'password' => Hash::make($request->password)
        ]);

        return redirect()->route('user.settings')->with([
            'status' => true,
            'message' => 'Successfully changed the password',
            'slot' => 'password'
        ]);
    }

    public function appointments(){
        $appointments = Appointment::where('user_id', auth()->id())->latest()->paginate(10);

        return view('user.appointment.list', compact('appointments'));
    }

    public function viewAppoint($id){
        $appointment = Appointment::where('user_id', auth()->id())->findOrFail($id);

        return view('user.appointment.view', compact('appointment'));
    }

    public function pets(){
        $user = auth()->user();
        $pets = Pet::where('owner_id', $user->owner->id)->paginate(10);

        return view('user.pets.list', compact('pets'));
    }

    public function viewPets($id){
        $user = auth()->user();

        $patient = Pet::where('owner_id', $user->owner->id)->where('id', $id)->firstOrFail();

        return view('user.pets.view', compact('patient'));

    }

    public function viewPetRecord($id, $rId){
        $record = PetRecord::where('id', $rId)->where('pet_id', $id)->firstOrFail();

        $user = auth()->user();

        if($record->pet->owner->user->id != $user->id){
            abort(404);
        }

        return view('user.pets.recordView', compact('record'));
    }
    // update info password

    // pets w/ records

}
