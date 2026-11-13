<?php

namespace Tests\Feature;

use App\Appointment;
use App\Owner;
use App\Pet;
use App\PetRecord;
use App\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Render smoke tests for the admin UI (owner: Claude / frontend).
 *
 * Proves the restyled Blade views compile and render against real model data for the
 * empty, populated and paginated cases, and pins the dashboard "still to come" rule.
 * Presentation only: it asserts nothing about authorization or business rules, which
 * remain covered by AccountIsolationTest.
 */
class AdminViewsRenderTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function person($email, $isAdmin = false)
    {
        $user = User::create([
            'email' => $email,
            'password' => bcrypt('example-password-not-used'),
            'is_admin' => $isAdmin ? 1 : 0,
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

    private function petFor($user, $name = 'Test Pet')
    {
        return Pet::create([
            'owner_id' => $user->owner->id,
            'name' => $name,
            'birth_date' => '2020-01-01',
            'gender' => 1,
            'color' => 'Brown',
            'species' => 1,
            'breed' => 'Mixed',
        ]);
    }

    public function testAdminPagesRenderWithData()
    {
        $admin = $this->person('admin@example.test', true);
        $client = $this->person('client@example.test');
        $pet = $this->petFor($client, 'Render Pet');
        $start = Carbon::now()->addDays(3)->setTime(9, 0);

        Appointment::create([
            'user_id' => $client->id,
            'pet_id' => $pet->id,
            'appointment_start' => $start,
            'appointment_end' => $start->copy()->addMinutes(30),
            'concern' => '0',
            'reason' => 'Render check reason',
        ]);
        $record = PetRecord::create([
            'pet_id' => $pet->id,
            'procedure' => 'Render procedure',
            'temperature' => '38.5',
            'weight' => '12',
            'comments' => '<p>Render note</p>',
        ]);

        $this->actingAs($admin);

        $this->get(route('admin.dashboard'))
            ->assertStatus(200)
            ->assertSee('Skip to main content')
            ->assertSee('aria-current')
            ->assertSee('Render Pet')
            ->assertSee('Render check reason');

        $this->get(route('admin.patient.list'))
            ->assertStatus(200)
            ->assertSee('Render Pet')
            ->assertSee('1 registered');

        $this->get(route('admin.appointment.list'))
            ->assertStatus(200)
            ->assertSee('Test Owner');

        $this->get(route('admin.patient.view', $pet->id))
            ->assertStatus(200)
            ->assertSee('Render procedure');

        $this->get(route('admin.patient.record.view', ['id' => $pet->id, 'rId' => $record->id]))
            ->assertStatus(200)
            ->assertSee('Render procedure');
    }

    public function testEmptyStatesRender()
    {
        $this->actingAs($this->person('admin@example.test', true));

        $this->get(route('admin.dashboard'))
            ->assertStatus(200)
            ->assertSee('No upcoming appointments');

        $this->get(route('admin.patient.list'))
            ->assertStatus(200)
            ->assertSee('No patients yet')
            ->assertSee('0 registered');

        $this->get(route('admin.appointment.list'))
            ->assertStatus(200)
            ->assertSee('No upcoming appointments');
    }

    public function testPatientListShowsPaginationLinksBeyondFirstPage()
    {
        $admin = $this->person('admin@example.test', true);
        $client = $this->person('client@example.test');
        for ($i = 1; $i <= 21; $i++) {
            $this->petFor($client, 'Pet ' . $i);
        }

        $this->actingAs($admin)
            ->get(route('admin.patient.list'))
            ->assertStatus(200)
            ->assertSee('21 registered')
            ->assertSee('page=2');
    }

    public function testDashboardStillToComeCountsOnlyAppointmentsNotYetStarted()
    {
        // Frozen clock: 12:00 on a fixed day, so "today" and "past" are deterministic.
        Carbon::setTestNow(Carbon::create(2026, 11, 13, 12, 0, 0));

        $admin = $this->person('admin@example.test', true);
        $client = $this->person('client@example.test');
        $pet = $this->petFor($client);

        $make = function ($start) use ($client, $pet) {
            $a = new Appointment([
                'user_id' => $client->id,
                'pet_id' => $pet->id,
                'appointment_start' => $start,
                'appointment_end' => $start->copy()->addMinutes(30),
                'concern' => '0',
            ]);
            $a->setRelation('user', $client);
            $a->setRelation('pet', $pet);

            return $a;
        };

        // Deliberately includes an earlier-today slot: the view must not count it.
        $grouped = collect([
            $make(Carbon::create(2026, 11, 13, 9, 0, 0)),   // today, already started
            $make(Carbon::create(2026, 11, 13, 15, 0, 0)),  // today, still to come
            $make(Carbon::create(2026, 11, 13, 16, 0, 0)),  // today, still to come
            $make(Carbon::create(2026, 11, 14, 10, 0, 0)),  // tomorrow
        ])->groupBy(function ($a) {
            return $a->appointment_start->day;
        });

        $this->actingAs($admin);
        $html = view('admin.dashboard', ['appointments' => $grouped])->render();

        $this->assertSame(1, preg_match(
            '/stat__value">(\d+)<\/span>\s*<span class="stat__label">Still to come today/', $html, $today
        ));
        $this->assertSame('2', $today[1], 'Only the two later slots today are still to come.');

        $this->assertSame(1, preg_match(
            '/stat__value">(\d+)<\/span>\s*<span class="stat__label">Upcoming appointments/', $html, $upcoming
        ));
        $this->assertSame('3', $upcoming[1], 'The already-started slot must not be counted as upcoming.');
    }
}
