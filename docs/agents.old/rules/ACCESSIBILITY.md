# Accessibility Rules

## Core Principles

### WCAG Compliance

- Target WCAG 2.1 Level AA minimum
- Strive for AAA where feasible
- Test with automated tools and manual review
- Include users with disabilities in testing

### POUR Guidelines

- **Perceivable**: Information must be presentable in different ways
- **Operable**: Interface must be keyboard navigable
- **Understandable**: Information and UI must be understandable
- **Robust**: Content must work with assistive technologies

## Semantic HTML

### Proper Element Usage

```typescript
// Good: Semantic HTML
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/home">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>

// Bad: Div soup
<div class="navigation">
  <div class="nav-item" onclick="navigate('/home')">Home</div>
</div>
```

### Heading Hierarchy

```typescript
// Correct heading structure
<h1>Page Title</h1>
  <h2>Section Title</h2>
    <h3>Subsection Title</h3>
  <h2>Another Section</h2>

// Skip heading levels only with aria-level
<h2 aria-level="4">Visually smaller heading</h2>
```

## Keyboard Navigation

### Focus Management

```typescript
// Custom button with proper keyboard support
const Button = ({ onClick, children, ...props }) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(e);
    }
  };

  return (
    <button onClick={onClick} onKeyDown={handleKeyDown} {...props}>
      {children}
    </button>
  );
};
```

### Tab Order

```typescript
// Logical tab order
<form>
  <input type="text" tabIndex={1} />
  <input type="email" tabIndex={2} />
  <button type="submit" tabIndex={3}>Submit</button>
</form>

// Remove from tab order when hidden
<button tabIndex={isHidden ? -1 : 0}>
  Hidden when not needed
</button>
```

### Skip Links

```typescript
// Skip to main content
<a href="#main-content" className="skip-link">
  Skip to main content
</a>

<main id="main-content" tabIndex={-1}>
  {/* Content */}
</main>

// CSS for skip link
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  text-decoration: none;

  &:focus {
    top: 0;
  }
}
```

## ARIA Attributes

### ARIA Labels

```typescript
// Icon buttons need labels
<button aria-label="Close dialog">
  <IconX />
</button>

// Complex widgets
<div
  role="slider"
  aria-valuenow={50}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-label="Volume control"
/>
```

### Live Regions

```typescript
// Announce dynamic changes
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {itemCount} items in cart
</div>

// Error announcements
<div
  role="alert"
  aria-live="assertive"
>
  {errorMessage}
</div>
```

### Descriptions and Labels

```typescript
// Associate labels with controls
<label htmlFor="email">Email Address</label>
<input
  id="email"
  type="email"
  aria-describedby="email-error"
  aria-invalid={hasError}
/>
<span id="email-error" role="alert">
  {errorMessage}
</span>
```

## Forms

### Field Requirements

```typescript
// Accessible form field
const FormField = ({ label, error, required, ...props }) => {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id}>
        {label}
        {required && <span aria-label="required">*</span>}
      </label>
      <input
        id={id}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <span id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
```

### Error Handling

```typescript
// Announce form errors
const [errors, setErrors] = useState<string[]>([]);

return (
  <form>
    <div role="alert" aria-live="assertive">
      {errors.length > 0 && (
        <>
          <h2>Please fix the following errors:</h2>
          <ul>
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </>
      )}
    </div>
    {/* Form fields */}
  </form>
);
```

## Color and Contrast

### Contrast Ratios

```css
/* Minimum contrast ratios */
:root {
  /* Normal text: 4.5:1 */
  --text-color: #333; /* on white: 12.63:1 ✓ */

  /* Large text: 3:1 */
  --heading-color: #555; /* on white: 7.46:1 ✓ */

  /* UI elements: 3:1 */
  --border-color: #767676; /* on white: 4.54:1 ✓ */
}
```

### Color Independence

```typescript
// Don't rely on color alone
<span className="error" aria-label="Error">
  ❌ Invalid input
</span>

// Status with icon and text
<div className={`status ${status}`}>
  {status === 'success' && <IconCheck aria-hidden="true" />}
  {status === 'error' && <IconX aria-hidden="true" />}
  <span>{statusMessage}</span>
</div>
```

## Images and Media

### Alt Text

```typescript
// Informative images
<img
  src="chart.png"
  alt="Sales increased 25% from 2022 to 2023"
/>

// Decorative images
<img
  src="decoration.png"
  alt=""
  role="presentation"
/>

// Complex images
<figure>
  <img
    src="complex-diagram.png"
    alt="System architecture"
    aria-describedby="diagram-description"
  />
  <figcaption id="diagram-description">
    The system consists of three layers: presentation,
    business logic, and data storage...
  </figcaption>
</figure>
```

### Video Accessibility

```typescript
// Accessible video player
<video controls>
  <source src="video.mp4" type="video/mp4" />
  <track kind="captions" src="captions.vtt" srclang="en" label="English" default />
  <track kind="descriptions" src="descriptions.vtt" srclang="en" label="English descriptions" />
</video>
```

## Testing

### Automated Testing

```typescript
// Using jest-axe
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('should be accessible', async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Manual Testing

- Test with keyboard only (no mouse)
- Use screen readers (NVDA, JAWS, VoiceOver)
- Test with browser zoom at 200%
- Disable CSS to check content order
- Use browser DevTools accessibility tree

### Testing Tools

```bash
# Automated tools
- axe DevTools browser extension
- Lighthouse (built into Chrome)
- WAVE (WebAIM)
- Pa11y CLI tool

# Screen readers
- NVDA (Windows, free)
- JAWS (Windows)
- VoiceOver (macOS/iOS)
- TalkBack (Android)
```

## React Patterns

### Focus Management

```typescript
// Restore focus after modal closes
const Modal = ({ isOpen, onClose, children }) => {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      // Focus first focusable element in modal
    } else if (previousFocus.current) {
      previousFocus.current.focus();
    }
  }, [isOpen]);

  return isOpen ? (
    <div role="dialog" aria-modal="true">
      {children}
    </div>
  ) : null;
};
```

### Announcements

```typescript
// Announce route changes
const RouteAnnouncer = () => {
  const location = useLocation();

  useEffect(() => {
    const announcement = `Navigated to ${document.title}`;
    // Announce to screen readers
  }, [location]);

  return <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" />;
};
```
