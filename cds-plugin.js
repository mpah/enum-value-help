const cds =  global.cds || require("@sap/cds");
const log = cds.log('enum-value-help');

// Check if an entity has @enumValueHelp or @enumValueHelpFixedValues annotation
const isEnumValueHelpEnabled = (entity) => {
  if (entity.query?.SET?.op === 'union') return false;
  if (entity['@enumValueHelp'] || entity['@enumValueHelpFixedValues']) return true;
  if (Object.values(entity.elements || {}).some(e => hasEnumValueHelpAnnotation(e))) return true;
  return false;
};

// Helper: check if field has @enumValueHelp or @enumValueHelpFixedValues annotation
const hasEnumValueHelpAnnotation = (field) => {
  return field['@enumValueHelp'] !== undefined || field['@enumValueHelpFixedValues'] !== undefined;
};

// Helper: does the entity contain fields with the annotation and returns array [fieldName, element]
const enumFieldsOf = (entity) => Object.entries(entity.elements || {}).filter(([, e]) => hasEnumValueHelpAnnotation(e));

// Helper: extract enum definition (either inline or via type)
function _enumDefOf (field) {
  if (field.enum) return field.enum;
  if (field.type) {
    const typeDef = cds.model.definitions[field.type];
    if (typeDef && typeDef.enum) return typeDef.enum;
  }
  return null;
}

// Helper: turn cds enum definition into array of {value}
function _toEnumArray (enumDef) {
  const res = [];
  for (const [key, val] of Object.entries(enumDef)) {
    if (val && typeof val === 'object') {
      res.push({ value: val.val ?? key });
    } else {
      res.push({ value: key });
    }
  }
  return res;
}

// Extract constant from a where clause with support for complex conditions
function _constantInWhere (where, refName) {
  if (!Array.isArray(where)) return undefined;
  
  // Recursive function to traverse nested where clause structures
  function findConstant(clause) {
    if (!Array.isArray(clause)) return undefined;
    
    // Handle different clause structures
    for (let i = 0; i < clause.length; i++) {
      const current = clause[i];
      
      // Check for simple equality: ref = value
      if (i + 2 < clause.length) {
        const t0 = clause[i], t1 = clause[i + 1], t2 = clause[i + 2];
        if (t0?.ref?.[0] === refName && t1 === '=' && t2?.val !== undefined) {
          return t2.val;
        }
      }
      
      // Handle nested conditions (parentheses)
      if (Array.isArray(current)) {
        const result = findConstant(current);
        if (result !== undefined) return result;
      }
      
      // Handle AND/OR operators - continue searching in remaining parts
      if (current === 'and' || current === 'or') {
        // Skip the operator and continue with next part
        continue;
      }
      
      // Handle objects that might contain nested conditions
      if (current && typeof current === 'object' && !current.ref && !current.val) {
        // This might be a nested condition object
        for (const value of Object.values(current)) {
          if (Array.isArray(value)) {
            const result = findConstant(value);
            if (result !== undefined) return result;
          }
        }
      }
    }
    
    return undefined;
  }
  
  return findConstant(where);
}

// Enhance model to process entities with @enumValueHelp annotation
function enhanceModel (m) {
  const _enhanced = 'enum.value.help.enhanced';
  if (m.meta?.[_enhanced]) return; // already enhanced

  log.debug('Enhancing model for enum value help...');

  // Create our EnumValueHelpView entity programmatically if it doesn't exist
  const enumViewEntityName = 'EnumValueHelpView';
  if (!m.definitions[enumViewEntityName]) {
    log.debug('Creating EnumValueHelpView entity programmatically...');
    
    // Create the global EnumValueHelpView entity
    m.definitions[enumViewEntityName] = {
      kind: 'entity',
      '@readonly': true,
      '@cds.persistence.skip': true,
      doc: 'Generic view that exposes enum values for any field annotated with @enumValueHelp',
      elements: {
        value: {
          key: true,
          type: 'cds.String',
          '@Core.Computed': false,
          '@title': 'Value'
        },
        entityName: {
          type: 'cds.String',
          '@Core.Computed': false
        },
        fieldName: {
          type: 'cds.String',
          '@Core.Computed': false
        }
      }
    };
    log.debug('EnumValueHelpView entity created successfully');
  }

  const servicesToExtend = new Set();

  for (const [name, entity] of Object.entries(m.definitions)) {
    if (entity.kind !== 'entity' || entity['@cds.autoexposed']) continue;
    if (!isEnumValueHelpEnabled(entity)) continue;

     log.debug(`Found entity with @enumValueHelp or @enumValueHelpFixedValues: ${name}`);

    for (const [fieldName, field] of enumFieldsOf(entity)) {
      // Add ValueListWithFixedValues annotation only if @enumValueHelpFixedValues is used
      if (field['@enumValueHelpFixedValues'] !== undefined && !field['@Common.ValueListWithFixedValues']) {
        field['@Common.ValueListWithFixedValues'] = true;
      }
      
      // Add ValueList annotation if not yet present
      if (!field['@Common.ValueList']) {
        field['@Common.ValueList'] = {
          CollectionPath: 'EnumValueHelpView',
          Parameters: [
            { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: fieldName, ValueListProperty: 'value' },
            { $Type: 'Common.ValueListParameterConstant', ValueListProperty: 'entityName', Constant: name },
            { $Type: 'Common.ValueListParameterConstant', ValueListProperty: 'fieldName', Constant: fieldName }
          ]
        };
      }
    }

    // remember service to extend
    const svcMatch = name.match(/^(.*)\.[^.]+$/);
    const svcName  = svcMatch && m.definitions[svcMatch[1]]?.kind === 'service' ? svcMatch[1] : null;
    if (svcName) servicesToExtend.add(svcName);

    // Mark entity processed (for debugging)
    entity['@enumValueHelp.processed'] = true;
  }

  // Auto-expose EnumValueHelpView to services that need it
  for (const svcName of servicesToExtend) {
    const projectionName = `${svcName}.EnumValueHelpView`;
    if (!m.definitions[projectionName]) {
       log.debug(`Auto-exposing EnumValueHelpView in ${svcName}`);
      m.definitions[projectionName] = {
        kind: 'entity',
        '@cds.autoexpose': true,
        '@readonly': true,
        elements: {
          value: {
            key: true,
            type: 'cds.String',
            '@title': 'Value'
          },
          entityName: {
            type: 'cds.String',
          },
          fieldName: {
            type: 'cds.String',
          }
        }
      };
    }
  }

  (m.meta ??= {})[_enhanced] = true;
}

// Register plugin hooks following CAP best practices
// Use 'loaded' event for model modifications - runs once when model is loaded but before compilation
cds.on('loaded', (csn) => { 
   log.debug('on', 'loaded'); 
  enhanceModel(csn); 
});

// Register dynamic READ handler for EnumValueHelpView once services are in place
function _addEnumValueHelpHandlers () {
  for (const srv of cds.services) {
    if (!(srv instanceof cds.ApplicationService)) continue;

    const enumView = srv.entities?.EnumValueHelpView;
    if (!enumView) continue;

     log.debug(`Adding READ handler for EnumValueHelpView in service ${srv.name}`);
     log.debug(`Entity name: ${enumView.name}, Entity keys:`, Object.keys(srv.entities));

    // Remove any previous registrations and instead use an AFTER handler so that
    // we can override the default result provided by the generic handler.
    const handler = async (rows, req) => {
       log.debug('▶︎ EnumValueHelpView after-handler reached', req.target?.name);

      // Determine entityName + fieldName from where clause or req.data
      const where = req.query?.SELECT?.where;
      const entityName = _constantInWhere(where, 'entityName') || req.data?.entityName;
      const fieldName  = _constantInWhere(where, 'fieldName')  || req.data?.fieldName;

      if (!entityName || !fieldName) return; // keep default (usually [])

      const target = cds.model.definitions[entityName];
      if (!target) return;
      const field  = target.elements?.[fieldName];
      if (!field) return;

      const enumDef = _enumDefOf(field);
      if (!enumDef) return;

      let result = _toEnumArray(enumDef).map(e => ({ ...e, entityName, fieldName }));

      // Apply basic filtering by $filter on value if provided
      if (where) {
        const valueFilter = _constantInWhere(where, 'value');
        if (valueFilter) result = result.filter(r => r.value === valueFilter);
      }

      // Clear the existing array and push new items instead of returning new array
      rows.length = 0; // Clear existing array
      rows.push(...result); // Add our enum values
       log.debug('▶︎ EnumValueHelpView modified rows:', rows);
    };

    srv.after('READ', enumView, handler);
  }
}

// Use 'once' to ensure handler registration runs only once after all services are bootstrapped
cds.once('served', _addEnumValueHelpHandlers)
