<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class Pet extends Model
{
    protected $fillable = [
        'owner_id', 'name', 'birth_date', 'gender', 'color', 'species', 'breed',
    ];
    protected $dates = ['birth_date'];

    const GENDER = ['Male', 'Female'];

    // const SPECIES = ['Bovine', 'Camelid', 'Canine', 'Caprine', 'Cavies', 'Cervidae', 'Equine', 'Feline', 'Lapine', 'Murine', 'Ovine', 'Piscine', 'Porcine'];

    const SPECIES = ['Canine (Dog)', 'Feline (Cat)'];

    public function owner(){
        return $this->belongsTo(Owner::class);
    }

    public function appointments(){
        return $this->hasMany(Appointment::class);
    }

    public function records(){
        return $this->hasMany(PetRecord::class);
    }

    public function getGenderNameAttribute(){
        return self::GENDER[$this->gender - 1];
    }

    public function getSpeciesNameAttribute(){
        return self::SPECIES[$this->species - 1] ?? $this->species;
    }
}
