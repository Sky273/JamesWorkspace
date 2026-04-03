import { useDismissiblePopover } from './EditorToolbar.hooks';

interface DropdownProps {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  isActive?: boolean;
  autoClose?: boolean;
}

export const Dropdown = ({
  trigger,
  title,
  children,
  isActive,
  autoClose = true,
}: DropdownProps) => {
  const { open, ref, close, toggle } = useDismissiblePopover<HTMLDivElement>();
  const content = typeof children === 'function' ? children(close) : children;

  return (
    <div className="tiptap-dropdown-wrapper" ref={ref}>
      <button
        type="button"
        className={`tiptap-toolbar-btn tiptap-dropdown-trigger ${isActive ? 'is-active' : ''}`}
        title={title}
        onClick={toggle}
      >
        {trigger}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="tiptap-dropdown-menu" onClick={autoClose ? close : undefined}>
          {content}
        </div>
      )}
    </div>
  );
};
