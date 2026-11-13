<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Appointment extends Model
{
    protected $fillable = ['user_id', 'pet_id', 'appointment_start', 'appointment_end', 'reason', 'concern'];

    protected $dates = ['appointment_start', 'appointment_end'];

    const CONCERN = ['Grooming', 'Consultation', 'Deworming', 'Vaccination', 'Blood Sampling'];

    public function pet(){
        return $this->belongsTo(Pet::class);
    }

    public function user(){
        return $this->belongsTo(User::class);
    }

    public function getConcernNameAttribute(){
        return is_numeric($this->concern) ? self::CONCERN[$this->concern] : 'Others - '.$this->concern;
    }
}
