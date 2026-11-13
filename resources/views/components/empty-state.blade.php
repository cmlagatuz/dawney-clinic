{{--
    Friendly empty state. Optional $icon (Font Awesome 4 name), $message, and a default slot for an action.
    @component('components.empty-state', ['title' => 'No patients yet', 'message' => '...', 'icon' => 'paw'])
        <a class="btn btn-primary" href="#">Add patient</a>
    @endcomponent
--}}
<div class="empty-state">
    <div class="empty-state__icon" aria-hidden="true"><i class="fa fa-{{ $icon ?? 'paw' }}"></i></div>
    <p class="empty-state__title">{{ $title }}</p>
    @isset($message)
        <p class="empty-state__message">{{ $message }}</p>
    @endisset
    @if (isset($slot) && trim((string) $slot) !== '')
        {{ $slot }}
    @endif
</div>
