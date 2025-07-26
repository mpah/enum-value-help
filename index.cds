/**
 * Annotation to mark fields that should have enum value help enabled.
 * When applied to a field, the plugin will automatically generate value help
 * based on the field's enum definition.
 */
annotation enumValueHelp : Boolean;

/**
 * Annotation to mark fields that should have enum value help with fixed values.
 * When applied to a field, the plugin will automatically generate value help
 * based on the field's enum definition and add Common.ValueListWithFixedValues.
 */
annotation enumValueHelpFixedValues : Boolean;



/**
 * Generic view that exposes enum values for any field annotated with @enumValueHelp.
 * Data is provided programmatically by the cds plugin, therefore the entity is marked
 * as READ-only and skipped during persistence.
 */
@readonly
@cds.persistence.skip
entity EnumValueHelpView {
  @title: 'Value'
  key value       : String;
      entityName  : String;
      fieldName   : String;
}