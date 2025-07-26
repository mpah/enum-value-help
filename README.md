# Enum Value Help Plugin for SAP CAP

A CAP (Cloud Application Programming) plugin that automatically generates value help functionality for enum fields in your CDS models. This plugin eliminates the need to manually configure value lists for enum fields, making your development process more efficient and your UI more user-friendly.

## Features

- **Automatic Value Help**: Automatically generates value help for fields annotated with `@enumValueHelp`
- **Fixed Values Support**: Optional `@enumValueHelpFixedValues` annotation for strict value validation
- **Zero Configuration**: Works out-of-the-box with minimal setup
- **Type Support**: Supports both inline enums and enum types
- **Service Auto-Exposure**: Automatically exposes required entities to your services
- **Fiori Integration**: Seamlessly integrates with SAP Fiori Elements

## Installation

```bash
npm install @mpah/enum-value-help
```

## Quick Start

1. **Install the plugin** (see above)

2. **Add annotations to your CDS models**:

```cds
using from '@mpah/enum-value-help';

// Define an enum type
type Priority : String enum {
    high;
    medium;
    low;
}

// Define an entity with enum fields
entity Issues : managed {
    key ID          : UUID;
    title           : String(100);
    
    // Enable value help for this enum field
    priority        : Priority @enumValueHelp;
    
    // Enable value help with fixed values
    status          : String enum {
        open;
        closed;
        draft;
    } @enumValueHelpFixedValues;
}
```

3. **Start your application** - the plugin automatically handles the rest!

## Configuration

### Annotations

| Annotation | Description | Effect |
|------------|-------------|---------|
| `@enumValueHelp` | Enables value help for enum fields | Adds `@Common.ValueList` annotation |
| `@enumValueHelpFixedValues` | Enables value help with fixed values | Adds both `@Common.ValueList` and `@Common.ValueListWithFixedValues` |

### Plugin Behavior

The plugin automatically:
- Detects entities with enum value help annotations
- Creates a global `EnumValueHelpView` entity
- Auto-exposes the view to relevant services
- Registers dynamic read handlers for enum data

## How It Works

1. **Model Enhancement**: During the CDS model loading phase, the plugin scans for entities with `@enumValueHelp` annotations
2. **Value List Generation**: Automatically adds `@Common.ValueList` annotations pointing to the `EnumValueHelpView`
3. **Dynamic Data**: The `EnumValueHelpView` serves enum values dynamically based on entity and field context
4. **Service Integration**: Auto-exposes the helper view to services that contain annotated entities

## License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.