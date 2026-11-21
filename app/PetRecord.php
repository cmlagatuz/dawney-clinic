<?php

namespace App;

use Illuminate\Database\Eloquent\Model;

class PetRecord extends Model
{

    protected $fillable = ['pet_id', 'procedure', 'temperature', 'weight', 'comments'];

    public function pet(){
        return $this->belongsTo(Pet::class);
    }

}
