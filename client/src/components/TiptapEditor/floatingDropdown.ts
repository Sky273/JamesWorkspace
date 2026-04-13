const VIEWPORT_MARGIN = 16;
const DROPDOWN_GAP = 8;
const FLOATING_DROPDOWN_OPEN_EVENT = 'tiptap-floating-dropdown-open';

export interface FloatingDropdownController {
  open: () => void;
  close: () => void;
  toggle: () => boolean;
  isOpen: () => boolean;
}

function updateFloatingPosition(anchor: HTMLElement, dropdown: HTMLElement): void {
  dropdown.classList.remove('is-align-right', 'is-above');
  dropdown.style.top = '0px';
  dropdown.style.left = '0px';

  const anchorRect = anchor.getBoundingClientRect();
  const dropdownRect = dropdown.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = anchorRect.left;
  let alignRight = false;

  if (left + dropdownRect.width > viewportWidth - VIEWPORT_MARGIN) {
    alignRight = true;
    left = anchorRect.right - dropdownRect.width;
  }

  left = Math.max(VIEWPORT_MARGIN, Math.min(left, viewportWidth - dropdownRect.width - VIEWPORT_MARGIN));

  let top = anchorRect.bottom + DROPDOWN_GAP;
  let isAbove = false;

  if (
    top + dropdownRect.height > viewportHeight - VIEWPORT_MARGIN
    && anchorRect.top - DROPDOWN_GAP - dropdownRect.height > VIEWPORT_MARGIN
  ) {
    isAbove = true;
    top = anchorRect.top - dropdownRect.height - DROPDOWN_GAP;
  }

  top = Math.max(VIEWPORT_MARGIN, Math.min(top, viewportHeight - dropdownRect.height - VIEWPORT_MARGIN));

  dropdown.classList.toggle('is-align-right', alignRight);
  dropdown.classList.toggle('is-above', isAbove);
  dropdown.style.left = `${Math.round(left)}px`;
  dropdown.style.top = `${Math.round(top)}px`;
}

export function attachFloatingDropdown(
  anchor: HTMLElement,
  dropdown: HTMLElement,
): FloatingDropdownController {
  let open = false;
  let rafId: number | null = null;

  const schedulePositionUpdate = () => {
    if (!open) {
      return;
    }
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
    }
    rafId = window.requestAnimationFrame(() => {
      rafId = null;
      updateFloatingPosition(anchor, dropdown);
    });
  };

  const close = () => {
    if (!open) {
      return;
    }

    open = false;
    dropdown.classList.remove('is-open');
    if (dropdown.parentElement === document.body) {
      document.body.removeChild(dropdown);
    }

    document.removeEventListener('click', handleDocumentClick, true);
    document.removeEventListener(FLOATING_DROPDOWN_OPEN_EVENT, handleOtherDropdownOpen as EventListener);
    window.removeEventListener('resize', schedulePositionUpdate);
    window.removeEventListener('scroll', schedulePositionUpdate, true);

    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      close();
      return;
    }
    if (anchor.contains(target) || dropdown.contains(target)) {
      return;
    }
    close();
  };

  const handleOtherDropdownOpen = (event: Event) => {
    const customEvent = event as CustomEvent<{ dropdown: HTMLElement }>;
    if (customEvent.detail?.dropdown === dropdown) {
      return;
    }
    close();
  };

  const ensureMounted = () => {
    if (dropdown.parentElement !== document.body) {
      document.body.appendChild(dropdown);
    }
  };

  const openDropdown = () => {
    if (open) {
      schedulePositionUpdate();
      return;
    }

    open = true;
    ensureMounted();
    dropdown.classList.add('is-open');
    schedulePositionUpdate();

    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener(FLOATING_DROPDOWN_OPEN_EVENT, handleOtherDropdownOpen as EventListener);
    window.addEventListener('resize', schedulePositionUpdate);
    window.addEventListener('scroll', schedulePositionUpdate, true);
    document.dispatchEvent(new CustomEvent(FLOATING_DROPDOWN_OPEN_EVENT, {
      detail: { dropdown },
    }));
  };

  return {
    open: openDropdown,
    close,
    toggle: () => {
      if (open) {
        close();
        return false;
      }
      openDropdown();
      return true;
    },
    isOpen: () => open,
  };
}
