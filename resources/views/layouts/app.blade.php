<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <!-- CSRF Token -->
    <meta name="csrf-token" content="{{ csrf_token() }}">

    <title>{{ config('app.name', 'Laravel') }}</title>

    <!-- Scripts -->
    {{-- <script src="{{ asset('js/app.js') }}" defer></script> --}}

    <!-- Fonts -->
    <link rel="dns-prefetch" href="//fonts.gstatic.com">
    <link href="https://fonts.googleapis.com/css?family=Nunito" rel="stylesheet">

    <!-- Styles -->
    <link href="{{ asset('css/app.css') }}" rel="stylesheet">
    <link href="{{ asset('css/style.css') }}" rel="stylesheet">
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tempusdominus-bootstrap-4/5.0.0-alpha14/css/tempusdominus-bootstrap-4.min.css" />

    <!-- script -->
    <script src="https://code.jquery.com/jquery-2.2.4.min.js" ></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.24.0/moment.js"></script>
    <script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/tempusdominus-bootstrap-4/5.0.0-alpha14/js/tempusdominus-bootstrap-4.min.js"></script>
    <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>

</head>
<body>
    <div id="app">
        <nav class="navbar navbar-expand-md navbar-light bg-white shadow-sm">
            <div class="container">
                <a class="navbar-brand" href="{{ url('/') }}">
                    {{ config('app.name', 'Laravel') }}
                </a>
                <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="{{ __('Toggle navigation') }}">
                    <span class="navbar-toggler-icon"></span>
                </button>

                <div class="collapse navbar-collapse" id="navbarSupportedContent">
                    <!-- Left Side Of Navbar -->
                    <ul class="navbar-nav mr-auto">
                        <li class="nav-item">
                            <a class="nav-link" href="{{ route('appointment.create') }}">Schedule an Appointment</a>
                        </li>
                    </ul>

                    <!-- Right Side Of Navbar -->
                    <ul class="navbar-nav ml-auto">
                        <!-- Authentication Links -->
                        @guest
                            <li class="nav-item">
                                <a class="nav-link" href="{{ route('login') }}">{{ __('Login') }}</a>
                            </li>
                            @if (Route::has('register'))
                                <li class="nav-item">
                                    <a class="nav-link" href="{{ route('register') }}">{{ __('Register') }}</a>
                                </li>
                            @endif
                        @else
                            @if(auth()->user()->is_admin)
                                <li class="nav-item">
                                    <a class="nav-link" href="{{ route('admin.dashboard') }}">Admin Panel</a>
                                </li>
                            @endif
                            <li class="nav-item dropdown">
                                <a id="navbarDropdown" class="nav-link dropdown-toggle" href="#" role="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" v-pre>
                                    {{ Auth::user()->owner->full_name }} <span class="caret"></span>
                                </a>

                                <div class="dropdown-menu dropdown-menu-right" aria-labelledby="navbarDropdown">
                                    <a class="dropdown-item" href="{{ route('user.appointment.list') }}">
                                        Appointments
                                    </a>
                                    <a class="dropdown-item" href="{{ route('user.pet.list') }}">
                                        Pets
                                    </a>
                                    <a class="dropdown-item" href="{{ route('user.settings') }}">
                                        Settings
                                    </a>
                                    <a class="dropdown-item" href="{{ route('logout') }}"
                                       onclick="event.preventDefault();
                                                     document.getElementById('logout-form').submit();">
                                        {{ __('Logout') }}
                                    </a>

                                    <form id="logout-form" action="{{ route('logout') }}" method="POST" style="display: none;">
                                        @csrf
                                    </form>
                                </div>
                            </li>
                        @endguest
                    </ul>
                </div>
            </div>
        </nav>

        <main class="py-4">
            <div class="container">
                @yield('content')
            </div>
        </main>
        <main>
            @yield('main')
        </main>

    <footer class="kilimanjaro_area">
        <!-- Top Footer Area Start -->
        <div class="foo_top_header_one section_padding_100_70">
            <div class="container">
                <div class="row">
                    <div class="col-12 col-md-6 col-lg-3">
                        <div class="kilimanjaro_part">
                            <h5>About Us</h5>
                            <p>We specialize in surgery and personalized pet care. If you have a new puppy or kitten, we are here to guide you along the way and recommend the appropriate vaccinations as well as when to spay or neuter your pet. We are an exceptional facility with state of the art veterinary equipment which we utilize to facilitate the very best care for your pets.</p>
                        </div>
                    </div>
                    <div class="col-12 col-md-6 col-lg-3">
                        <div class="kilimanjaro_part">
                            <h5>Where to find us?</h5>
                            <p>80 Perpetual Help St, Penafrancia Ave, Naga City, Camarines Sur 4400 Philippines <br>
                                <a href="https://www.google.com/maps/place/Dawney+Animal+Clinic+Naga/@13.6364404,123.1971054,16z/data=!4m5!3m4!1s0x0:0xc42df55ec764f9d!8m2!3d13.6356107!4d123.1977405">Google Maps</a>
                            </p>
                        </div>
                    </div>
                    <div class="col-12 col-md-6 col-lg-3">
                        <div class="kilimanjaro_part">
                            <h5>Social Links</h5>
                            <ul class="kilimanjaro_social_links">
                                <li><a href="https://www.facebook.com/Dawney-Animal-Clinic-Naga-469007536828530/"><i class="fa fa-facebook" aria-hidden="true"></i> Facebook</a></li>
                            </ul>

                            <div class="kilimanjaro_single_contact_info mt-3">
                                <h5 class="mb-2">Store Hours:</h5>
                                <p class="mb-0">Monday to Saturday</p>
                                <p>8:00AM - 5:00PM</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-12 col-md-6 col-lg-3">
                        <div class="kilimanjaro_part">
                            <h5>Quick Contact</h5>
                            <div class="kilimanjaro_single_contact_info">
                                <h5 class="mb-2">Veterinarian:</h5>
                                <p>
                                    <a href="https://www.thefilipinovet.com/veterinarians/dawney-maria-kathleen-ranola-2014003425/">
                                        Maria Kathleen R. Dawney, D.V.M.
                                    </a>
                                </p>
                            </div>
                            <div class="kilimanjaro_single_contact_info">
                                <h5 class="mb-2">Phone:</h5>
                                <p>+639 95 971 5245</p>
                            </div>
                            <div class="kilimanjaro_single_contact_info">
                                <h5 class="mb-2">Email:</h5>
                                <p>support@dawneyanimalclinic.xyz<br> emergency@dawneyanimalclinic.xyz</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Footer Bottom Area Start -->
        <div class=" kilimanjaro_bottom_header_one section_padding_50 text-center">
            <div class="container">
                <div class="row">
                    <div class="col-12">
                        <p>© All Rights Reserved by <a href="#">{{ config('app.name')}}</p>
                    </div>
                </div>
            </div>
        </div>
    </footer>
    </div>
    @yield('script')
</body>
</html>
