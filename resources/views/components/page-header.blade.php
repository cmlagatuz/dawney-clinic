{{--
    Page heading with optional subtitle and action buttons.
    @component('components.page-header', ['title' => 'Patients', 'subtitle' => '12 registered'])
        @slot('actions') <a class="btn btn-primary" href="#">Add</a> @endslot
    @endcomponent
--}}
<div class="page-header">
    <div class="page-header__text">
        <h1 class="page-header__title">{{ $title }}</h1>
        @isset($subtitle)
            <p class="page-header__subtitle">{{ $subtitle }}</p>
        @endisset
    </div>
    @isset($actions)
        <div class="page-header__actions">{{ $actions }}</div>
    @endisset
</div>
