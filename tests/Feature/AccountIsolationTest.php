<?php

namespace Tests\Feature;

use App\Appointment;
use App\Owner;
use App\Pet;
use App\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountIsolationTest extends TestCase
{
    use RefreshDatabase;

    private function client($email)
    {
        $user = User::create([
            'email' => $email,
            'password' => bcrypt('example-password-not-used'),
        ]);
        $user->email_verified_at = Carbon::now();
        $user->save();

        Owner::create([
            'user_id' => $user->id,
            'first_name' => 'Test',
            'last_name' => 'Owner',
            'contact_number' => '09123456789',
            'address' => 'Test address',
        ]);

        return $user;
    }

    private function petFor($user)
    {
        return Pet::create([
            'owner_id' => $user->owner->id,
            'name' => 'Test Pet',
            'birth_date' => '2020-01-01',
            'gender' => 1,
            'color' => 'Brown',
            'species' => 1,
            'breed' => 'Mixed',
        ]);
    }

    public function testClientCanViewOwnAppointment()
    {
        $client = $this->client('owner@example.test');
        $pet = $this->petFor($client);
        $start = Carbon::now()->addWeek()->setTime(8, 0);

        $appointment = Appointment::create([
            'user_id' => $client->id,
            'pet_id' => $pet->id,
            'appointment_start' => $start,
            'appointment_end' => $start->copy()->addMinutes(30),
            'concern' => '0',
        ]);

        $this->actingAs($client)
            ->get(route('user.appointment.view', $appointment->id))
            ->assertStatus(200);
    }

    public function testClientCannotViewAnotherClientsAppointment()
    {
        $owner = $this->client('owner@example.test');
        $other = $this->client('other@example.test');
        $pet = $this->petFor($owner);
        $start = Carbon::now()->addWeek()->setTime(8, 0);

        $appointment = Appointment::create([
            'user_id' => $owner->id,
            'pet_id' => $pet->id,
            'appointment_start' => $start,
            'appointment_end' => $start->copy()->addMinutes(30),
            'concern' => '0',
        ]);

        $this->actingAs($other)
            ->get(route('user.appointment.view', $appointment->id))
            ->assertStatus(404);
    }

    public function testClientCannotBookAnotherClientsPet()
    {
        $owner = $this->client('owner@example.test');
        $other = $this->client('other@example.test');
        $pet = $this->petFor($owner);

        $this->actingAs($other)
            ->post(route('appointment.store'), [
                'pet_id' => $pet->id,
                'appointment_time' => Carbon::now()->addDays(2)->toDateString(),
                'hour' => 0,
                'concern' => 1,
            ])->assertSessionHasErrors('pet_id');

        $this->assertEquals(0, Appointment::count());
    }

    public function testOutOfRangeBookingSlotIsRejected()
    {
        $client = $this->client('owner@example.test');
        $pet = $this->petFor($client);

        $this->actingAs($client)
            ->post(route('appointment.store'), [
                'pet_id' => $pet->id,
                'appointment_time' => Carbon::now()->addDays(2)->toDateString(),
                'hour' => 999,
                'concern' => 1,
            ])->assertSessionHasErrors('hour');

        $this->assertEquals(0, Appointment::count());
    }

    public function testUnknownConcernIsRejected()
    {
        $client = $this->client('owner@example.test');
        $pet = $this->petFor($client);

        $this->actingAs($client)
            ->post(route('appointment.store'), [
                'pet_id' => $pet->id,
                'appointment_time' => Carbon::now()->addDays(2)->toDateString(),
                'hour' => 0,
                'concern' => 999,
            ])->assertSessionHasErrors('concern');

        $this->assertEquals(0, Appointment::count());
    }
}
