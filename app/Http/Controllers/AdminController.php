<?php

namespace App\Http\Controllers;

use App\Appointment;
use App\Mail\UserPassword;
use App\Order;
use App\OrderProduct;
use App\Owner;
use App\Pet;
use App\PetRecord;
use App\Product;
use App\ProductStock;
use App\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

use Nexmo\Laravel\Facade\Nexmo;

class AdminController extends Controller{


    public function dashboard(){

        $appointments = Appointment::where('appointment_start', '>=', Carbon::now())->get()->groupBy(function($q){
            return $q->appointment_start->day;
        })->sortBy(function($item){
            return $item[0]->appointment_start;
        });

        return view('admin.dashboard', compact('appointments'));
    }

    public function appointmentList(){
        $appointments = Appointment::where('appointment_start', '>=', Carbon::now())->latest()->paginate(20);

        return view('admin.appointment.list', compact('appointments'));
    }

    public function appointmentRemind($id){
        $appointment = Appointment::findOrFail($id);

        $number = $appointment->user->owner->contact_number;

        $number = substr($number, 1);

        $number = '63'. $number;

        Nexmo::message()->send([
            'to'   => $number,
            'from' => '639999385515',
            'text' => 'You have an appointmnet in Dawney Animal Clinic at '. $appointment->appointment_start->format('h:i a') . ' ' . $appointment->appointment_start->toDateString()
        ]);

        return redirect()->route('admin.appointment.list')->with([
            'status' => true,
            'message' => 'Successfully Notified'
        ]);
    }

    public function userCreatePatient(){
        return view('admin.user.createPatient');
    }

    public function userCreatePatientPost(Request $request, $id){
        $user = User::findOrFail($id);

        $request->validate([
            'name' => 'required',
            'gender' => 'required',
            'color' => 'required',
            'species' => 'required',
            'breed' => 'required',
            'date_birth' => 'required|date',
        ]);

        $pet = Pet::create([
            'owner_id' => $user->owner->id,
            'name' => $request->name,
            'gender' => $request->gender,
            'color' => $request->color,
            'species' => $request->species,
            'breed' => $request->breed,
            'birth_date' => Carbon::parse($request->date_birth),
        ]);

        return redirect()->route('admin.patient.view', $pet->id)->with([
            'status' => true,
            'message' => 'Successfully added patient'
        ]);

    }

    public function userView($id){
        $user = User::with('owner')->findOrFail($id);

        return view('admin.user.view', compact('user'));
    }

    public function userList(){
        $users = User::with('owner')->paginate(20);

        return view('admin.user.list', compact('users'));
    }

    public function userUpdate($id){
        $user = User::findOrFail($id);

        return view('admin.user.update', compact('user'));
    }

    public function userUpdatePost(Request $request, $id){
        $user = User::findOrFail($id);

        $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'contact_number' => ['required', 'string', 'max:11', 'regex:/^(09)\d{9}$/'],
            'address' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,id,'. $user->id],
        ]);

        if($user->id != 1){
            $user->update([
                'email' => $request->email,
                'is_admin' => $request->is_admin ? true : false
            ]);
        }else{
            $user->update([
                'email' => $request->email,
            ]);
        }
        $user->owner->update([
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'contact_number' => $request->contact_number,
            'address' => $request->address
        ]);

        return redirect()->route('admin.user.update', $user->id)->with([
            'status' => true,
            'message' => 'Successfully updated'
        ]);
    }


    public function patientList(){
        $pets = Pet::paginate(20);

        return view('admin.patient.list', compact('pets'));
    }

    public function patientCreate(){
        return view('admin.patient.create');
    }

    public function patientCreateStore(Request $request){
        $request->validate([
            'name' => 'required',
            'gender' => 'required',
            'color' => 'required',
            'species' => 'required',
            'breed' => 'required',
            'date_birth' => 'required|date',
            'first_name' => 'required',
            'last_name' => 'required',
            'contact_number' => ['required', 'string', 'max:11', 'regex:/^(09)\d{9}$/'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'address' => ['required', 'string', 'max:255'],
        ]);

        $password = Str::random(10);

        $user = User::create([
            'email' => $request->email,
            'password' => Hash::make($password)
        ]);

        $owner = Owner::create([
            'user_id' => $user->id,
            'first_name' => $request->first_name,
            'last_name' => $request->last_name,
            'contact_number' => $request->contact_number,
            'address' => $request->address
        ]);

        $pet = Pet::create([
            'owner_id' => $owner->id,
            'name' => $request->name,
            'gender' => $request->gender,
            'color' => $request->color,
            'species' => $request->species,
            'breed' => $request->breed,
            'birth_date' => Carbon::parse($request->date_birth),
        ]);


        Mail::to($user->email)->send(new UserPassword([
            'email' => $user->email,
            'password' => $password
        ]));

        return redirect()->route('admin.patient.create')->with([
            'status' => true,
            'message' => 'Successfully added patient'
        ]);

    }

    public function patientUpdate($id){
        $patient = Pet::findOrFail($id);

        return view('admin.patient.update', compact('patient'));
    }

    public function patientUpdatePost(Request $request, $id){
        $pet = Pet::findOrFail($id);

        $request->validate([
            'name' => 'required',
            'gender' => 'required',
            'color' => 'required',
            'species' => 'required',
            'breed' => 'required',
            'date_birth' => 'required|date'
        ]);

        $pet->update($request->except('_TOKEN', 'date_birth'));

        $pet->update([
            'birth_date' => Carbon::parse($request->date_birth),
        ]);

        return redirect()->route('admin.patient.update', $pet->id)->with([
            'status' => true,
            'message' => 'Successfully updated'
        ]);

    }

    public function patientView($id){
        $patient = Pet::findOrFail($id);

        return view('admin.patient.view', compact('patient'));
    }

    public function patientRecordCreate($id){

        $patient = Pet::findOrFail($id);

        return view('admin.patient.recordCreate', compact('patient'));

    }

    public function patientRecordCreatePost(Request $request, $id){
        $patient = Pet::findOrFail($id);

        $request->validate([
            'procedure' => 'required',
            'temperature' => 'required|numeric',
            'weight' => 'required|numeric'
        ]);

        PetRecord::create([
            'pet_id' => $patient->id,
            'procedure' => $request->procedure,
            'temperature' => $request->temperature,
            'weight' => $request->weight,
            'comments' => $request->comment
        ]);

        return redirect()->route('admin.patient.record.create', $id)->with([
            'status' => true,
            'message' => 'Successfully added new record'
        ]);

    }

    public function patientRecordView($id, $rId){

        $record = PetRecord::where('id', $rId)->where('pet_id', $id)->firstOrFail();

        return view('admin.patient.recordView', compact('record'));

    }

    public function inventoryList(){
        $products = Product::latest()->with(['stocks'])->paginate(20);

        return view('admin.inventory.list', compact('products'));
    }

    public function inventoryCreate(){
        return view('admin.inventory.create');
    }

    public function inventoryCreateStore(Request $request){
        $request->validate([
            'name' => 'required',
            'price' => 'required|numeric',
        ]);

        $product = Product::create([
            'name' => $request->name,
            'price' => $request->price,
        ]);

        return redirect()->route('admin.inventory.create')->with([
            'status' => true,
            'message' => 'Successfully added'
        ]);

    }

    public function inventoryUpdate($id){
        $product = Product::with('stocks')->findOrFail($id);

        return view('admin.inventory.update', compact('product'));
    }

    public function inventoryUpdatePost(Request $request, $id){
        $product = Product::findOrFail($id);

        $request->validate([
            'name' => 'required',
            'price' => 'required|numeric',
            'stock' => 'numeric|nullable',
        ]);

        $product->update([
            'name' => $request->name,
            'price' => $request->price,
        ]);

        if($request->has('stock') && $request->stock != 0){
            ProductStock::create([
                'product_id' => $product->id,
                'stock' => $request->stock,
                'quantity' => $request->stock
            ]);
        }

        return redirect()->route('admin.inventory.update', $product->id)->with([
            'status' => true,
            'message' => 'Successfully updated'
        ]);
    }

    public function purchaseCreate(){
        $products = Product::all();

        return view('admin.order.purchase', compact('products'));
    }

    public function purchaseCreatePost(Request $request){

        if(count($request->products) == 0){
            return response()->json([
                'status' => false,
                'message' => 'Please add products first',
            ]);
        }

        $order = Order::create([
            'name' => $request->name,
            'paid_price' => 0
        ]);

        $total = 0;

        foreach($request->products as $product){
            $prod = Product::where('id', $product['productID'])->first();
            $sub = $prod->price * $product['productQuantity'];

            $stock = $prod->stocks->where('stock', '!=', 0)->first();
            $stock->stock = $stock->stock - $product['productQuantity'];
            $stock->save();

            OrderProduct::create([
                'product_id' => $prod->id,
                'order_id' => $order->id,
                'quantity' => $product['productQuantity'],
                'total_price' => $total
            ]);

            $total+= $sub;
        }

        $order->paid_price = $total;
        $order->save();

        return response()->json([
            'status' => true,
            'message' => 'Successfully ordered',
            'orderID' => $order->id
        ]);
    }

    public function orderList(){
        $orders = Order::latest()->paginate(20);

        return view('admin.order.list', compact('orders'));
    }

    public function orderView($id){
        $order = Order::with('products')->findOrFail($id);

        return view('admin.order.view', compact('order'));
    }
}
