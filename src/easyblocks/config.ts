import JSON5 from 'json5';
import { reduce, set } from 'lodash-es';
import ShopifyTemplate from '@/compatibility/shopify-objects/template';

import { SECTION_GROUP_CONTENT, getSectionGroupProp } from '../utils';

import {
  schemaToEasyblocksProps,
  schemaToEasyblocksValue,
  toEasyblocksFieldId,
} from './utils';

import type {
  Backend,
  Document,
  ExternalSchemaProp,
  InternalTemplate,
  NoCodeComponentDefinition,
  NoCodeComponentEntry,
  SchemaProp,
  UserDefinedTemplate,
} from '@swell/easyblocks-core';

import type { SwellTheme } from '../theme';

import type {
  SwellData,
  SwellThemeConfig,
  ThemeGlobals,
  ThemeLayoutSectionGroupConfig,
  ThemePageSectionSchema,
  ThemeSectionConfig,
  ThemeSectionEnabledDisabled,
  ThemeSettingFieldSchema,
} from 'types/swell';

// By default, Easyblocks wraps each section in a SelectionFrameController.
// This wrapper interferes with CSS styles, and it is not needed,
// as the Swell Theme Editor has its own logic for sections/blocks.
// noInline=true disables the Easyblocks SelectionFrameController.
const NO_INLINE = true;

export async function getEasyblocksPageTemplate<T>(
  theme: SwellTheme,
  pageId: string,
  altTemplate?: string,
): Promise<T | string | undefined> {
  let templateConfig: SwellThemeConfig | null = null;

  let templateData = {
    name: pageId,
  } as SwellData;

  if (theme.shopifyCompatibility) {
    templateData = ShopifyTemplate(theme.shopifyCompatibility, templateData);
  }

  const { name } = templateData;

  templateConfig = await theme.getThemeTemplateConfigByType(
    'templates',
    name as string,
    altTemplate,
  );

  if (templateConfig) {
    let result = templateConfig.file_data;
    if (!templateConfig.file_path.endsWith('.liquid')) {
      try {
        result = JSON5.parse<string>(templateConfig.file_data);
      } catch {
        // use templateConfig.file_data
      }
    }

    if (result && typeof result === 'object') {
      (result as { id: string }).id = name as string;
    }

    return result;
  }
}

function getAcceptedLayoutSections(
  allSections: ThemePageSectionSchema[],
  groupType: string,
): string[] {
  return allSections.reduce((acc: string[], section) => {
    if (section.enabled_on) {
      if (checkEnabledDisabledOn(section.enabled_on, 'groups', groupType)) {
        acc.push(String(section.id));
      }
    } else if (section.disabled_on) {
      if (!checkEnabledDisabledOn(section.disabled_on, 'groups', groupType)) {
        acc.push(String(section.id));
      }
    } else {
      // Default to section of the same type name
      // Note: limit is also supposed to be 1 for sections named after group types
      if (section.id === groupType) {
        acc.push(String(section.id));
      }
    }
    return acc;
  }, []);
}

function getLayoutSectionGroupComponentProps(
  allSections: ThemePageSectionSchema[],
  layoutSectionGroups: ThemeLayoutSectionGroupConfig[],
): SchemaProp[] {
  return layoutSectionGroups.map<SchemaProp>((sectionGroup) => ({
    prop: getSectionGroupProp(sectionGroup.id),
    type: 'component-collection',
    label: sectionGroup.label,
    required: true,
    noInline: NO_INLINE,
    accepts: getAcceptedLayoutSections(allSections, sectionGroup.type),
  }));
}

function checkEnabledDisabledOn(
  config: ThemeSectionEnabledDisabled,
  key: 'groups' | 'templates',
  targetId: string,
): boolean {
  if (config.templates === '*') {
    return true;
  }

  if (config[key]?.includes(targetId)) {
    return true;
  }

  return false;
}

function getAcceptedSections(
  allSections: ThemePageSectionSchema[],
  layoutSectionGroups: ThemeLayoutSectionGroupConfig[],
  pageId: string,
): string[] {
  return allSections.reduce<string[]>((acc, section) => {
    if (section.enabled_on) {
      if (checkEnabledDisabledOn(section.enabled_on, 'templates', pageId)) {
        acc.push(String(section.id));
      }
    } else if (section.disabled_on) {
      if (!checkEnabledDisabledOn(section.disabled_on, 'templates', pageId)) {
        acc.push(String(section.id));
      }
    } else {
      // Default hide sections named after layout section group types
      if (!layoutSectionGroups.some(({ type }) => type === section.id)) {
        acc.push(String(section.id));
      }
    }
    return acc;
  }, []);
}

function getEditorSchemaComponentProps(
  themeGlobals: ThemeGlobals,
): SchemaProp[] {
  return (themeGlobals?.configs?.editor?.settings ?? []).reduce<SchemaProp[]>(
    (acc, settingGroup) => {
      for (const field of settingGroup.fields || []) {
        acc.push({
          prop: toEasyblocksFieldId(field.id),
          label: field.label,
          optional: true,
          group: settingGroup.label,
          ...schemaToEasyblocksProps(field),
        });
      }

      return acc;
    },
    [],
  );
}

function getAllSectionComponents(
  allSections: ThemePageSectionSchema[],
): NoCodeComponentDefinition[] {
  const list: NoCodeComponentDefinition[] = [];

  for (const section of allSections) {
    const hasBlocks =
      Array.isArray(section.blocks) && section.blocks.length > 0;

    list.push({
      id: section.id,
      label: section.label,
      schema: [
        ...(section.fields || []).reduce<ExternalSchemaProp[]>(
          (acc, field, currentIndex) => {
            if (field.type) {
              // generate missed field id
              const fieldId = field.id || `${field.type}_${currentIndex}`;

              acc.push({
                prop: toEasyblocksFieldId(fieldId),
                label: field.label,
                optional: true,
                ...schemaToEasyblocksProps(field),
              });
            }

            return acc;
          },
          [],
        ),
        ...(hasBlocks
          ? [
              {
                prop: 'Blocks',
                type: 'component-collection',
                required: true,
                noInline: NO_INLINE,
                accepts: (section.blocks || []).map(
                  (block) => `Block__${section.id}__${block.type}`,
                ),
                // TODO: figure out how to make this work, doesn't work for collections normally
                defaultValue: section.presets?.reduce<NoCodeComponentEntry[]>(
                  (acc, preset, index) => {
                    if (!preset.blocks || !Array.isArray(preset.blocks)) {
                      return acc;
                    }

                    return preset.blocks.reduce<NoCodeComponentEntry[]>(
                      (acc, block) => {
                        const blockDef = section.blocks?.find(
                          ({ type }) => type === block.type,
                        );

                        if (blockDef) {
                          acc.push({
                            _id: `Block__${section.id}__${block.type}__preset_${index}`,
                            _component: `Block__${section.id}__${block.type}`,
                            ...reduce(
                              blockDef.fields,
                              (acc, blockField) => {
                                if (blockField.id) {
                                  acc[blockField.id] = schemaToEasyblocksValue(
                                    blockDef.fields,
                                    blockField.id,
                                    blockField.default,
                                  );
                                }

                                return acc;
                              },
                              {} as Record<string, unknown>,
                            ),
                          });
                        }

                        return acc;
                      },
                      acc,
                    );
                  },
                  [],
                ),
                placeholderAppearance: {
                  height: 50,
                  label: 'Add block',
                  aspectRatio: 1,
                },
              } as ExternalSchemaProp,
            ]
          : []),
        {
          prop: 'custom_css',
          type: 'swell_css',
          label: 'Custom CSS',
          description: 'Add custom CSS for this section',
          layout: 'column',
          isLabelHidden: true,
          params: {
            rows: 5,
            placeholder: 'Enter custom CSS...',
          },
        } as ExternalSchemaProp,
        {
          prop: '$locale',
          type: 'swell_locale',
          isLabelHidden: true,
        },
      ],
      styles: () => {
        return {
          styled: {
            Root: {},
          },
        };
      },
    });

    if (hasBlocks) {
      list.push(
        ...(section.blocks || []).map<NoCodeComponentDefinition>((block) => ({
          id: `Block__${section.id}__${block.type}`,
          label: block.label,
          schema: (block.fields || []).reduce<SchemaProp[]>(
            (acc, field, currentIndex) => {
              if (field.type) {
                // generate missed field id
                const fieldId = field.id || `${field.type}_${currentIndex}`;

                acc.push({
                  prop: toEasyblocksFieldId(fieldId),
                  label: field.label,
                  optional: true,
                  ...schemaToEasyblocksProps(field),
                });
              }

              return acc;
            },
            [
              {
                prop: '$locale',
                type: 'swell_locale',
                isLabelHidden: true,
              },
            ],
          ),
          styles: () => {
            return {
              styled: {
                Root: {},
              },
            };
          },
        })),
      );
    }
  }

  return list;
}

function getEditorSchemaTemplateValues(
  themeGlobals: ThemeGlobals,
): Partial<NoCodeComponentEntry> | undefined {
  return themeGlobals?.configs?.editor?.settings?.reduce(
    (acc, settingGroup) => {
      for (const field of settingGroup.fields || []) {
        if (field?.id) {
          acc[field.id] = schemaToEasyblocksValue(
            settingGroup.fields,
            field.id,
            themeGlobals?.configs?.theme?.[field.id],
          );
        }
      }
      return acc;
    },
    {} as Partial<NoCodeComponentEntry>,
  );
}

function getLayoutSectionGroupTemplateValues(
  layoutSectionGroups: ThemeLayoutSectionGroupConfig[],
): Record<string, NoCodeComponentEntry[]> {
  return layoutSectionGroups.reduce(
    (acc, sectionGroup) => {
      acc[getSectionGroupProp(sectionGroup.id)] =
        sectionGroup.sectionConfigs.map<NoCodeComponentEntry>(
          ({ section, settings, schema }) => ({
            _id: `SectionGroup__${section.type}_${getRandomId()}`,
            _component: section.type,
            ...reduce(
              settings?.section.settings,
              (acc, value, key) => {
                acc[key] = schemaToEasyblocksValue(schema?.fields, key, value);
                return acc;
              },
              {} as Record<string, unknown>,
            ),
            custom_css: settings?.section['custom_css'] || '',
            ...(settings?.section.blocks
              ? {
                  Blocks: settings.section.blocks.map<NoCodeComponentEntry>(
                    (block) => ({
                      _id: `Block__${section.type}__${block.type}_${getRandomId()}`,
                      _component: `Block__${section.type}__${block.type}`,
                      ...reduce(
                        block.settings,
                        (acc, value, key) => {
                          acc[key] = schemaToEasyblocksValue(
                            schema?.blocks?.find(
                              ({ type }) => type === block.type,
                            )?.fields,
                            key,
                            value,
                          );

                          return acc;
                        },
                        {} as Record<string, unknown>,
                      ),
                    }),
                  ),
                }
              : undefined),
          }),
        );

      return acc;
    },
    {} as Record<string, NoCodeComponentEntry[]>,
  );
}

function prepareSectionId(id?: string): string {
  // we can't use / in script selectors
  return (id || '').replaceAll('/', '_');
}

function getAllSectionComponentTemplates(
  allSections: ThemePageSectionSchema[],
): InternalTemplate[] {
  const list: InternalTemplate[] = [];

  // Helper to convert fields + $locale into easyblocks object
  const processFields = (
    fields: ThemeSettingFieldSchema[],
    settings: Record<string, unknown> = {},
  ): Record<string, unknown> => {
    const result: Record<string, unknown> = {};

    for (const field of fields) {
      if (!field?.id) {
        continue;
      }

      const { id: fieldId, $locale } = field;

      // Convert field to easyblocks value
      result[fieldId] = schemaToEasyblocksValue(
        fields,
        fieldId,
        settings[fieldId],
      );

      // Add localized values to $locale
      if ($locale) {
        for (const [locale, localeValues] of Object.entries($locale)) {
          const defaultValue = localeValues?.default;

          if (defaultValue) {
            set(result, `$locale.${locale}.${fieldId}`, defaultValue);
          }
        }
      }
    }

    return result;
  };

  for (const section of allSections) {
    // Process section presets
    if (section.presets) {
      for (let index = 0; index < section.presets.length; index++) {
        const preset = section.presets[index];

        const entry: InternalTemplate['entry'] = {
          _id: `${section.id}__preset_${index}`,
          _component: section.id,
          custom_css: (preset.settings?.['custom_css'] || '') as string,
          ...processFields(section.fields, preset.settings),
          // Process blocks inside the preset
          Blocks: (Array.isArray(preset.blocks) ? preset.blocks : [])
            .map((block) => {
              const blockSchema = section.blocks?.find(
                ({ type }) => type === block.type,
              );

              if (!blockSchema) {
                return null;
              }

              return {
                _id: `Block__${section.id}__${block.type}__preset_${index}`,
                _component: `Block__${section.id}__${block.type}`,
                ...processFields(blockSchema.fields, block.settings),
              };
            })
            .filter(Boolean) as NoCodeComponentEntry[],
        };

        list.push({
          id: `${section.id}__preset_${index}`,
          entry,
        });
      }
    }

    // Process standalone blocks
    if (section.blocks) {
      for (const block of section.blocks) {
        list.push({
          id: `Block__${section.id}__${block.type}`,
          entry: {
            _id: `Block__${section.id}__${block.type}`,
            _component: `Block__${section.id}__${block.type}`,
            ...processFields(
              block.fields,
              block.fields.reduce<Record<string, unknown>>((acc, f) => {
                if (f.id) acc[f.id] = f.default;
                return acc;
              }, {}),
            ),
          },
        });
      }
    }
  }

  return list;
}

export function getEasyblocksPagePropsWithConfigs(
  themeGlobals: ThemeGlobals,
  allSections: ThemePageSectionSchema[],
  pageSections: ThemeSectionConfig[],
  layoutSectionGroups: ThemeLayoutSectionGroupConfig[],
  pageId: string,
) {
  const rootComponent: NoCodeComponentDefinition = {
    id: 'swell_global',
    // label: 'Page: ' + pageId,
    label: 'Theme settings',
    schema: [
      {
        prop: 'swell_page',
        type: 'component',
        required: true,
        accepts: ['swell_page'],
        isNonChangable: true,
        noInline: NO_INLINE,
      },
      {
        prop: '$locale',
        type: 'swell_locale',
        isLabelHidden: true,
      },
      ...getEditorSchemaComponentProps(themeGlobals),
    ],
    // Collapse all global page settings
    groups: (themeGlobals?.configs?.editor?.settings ?? []).map(
      (settingGroup) => {
        return {
          key: settingGroup.label,
          label: settingGroup.label,
          collapsable: true,
          collapsed: true,
        };
      },
    ),
    styles: () => {
      return {
        styled: {
          Root: {},
        },
      };
    },
  };

  const pageComponent: NoCodeComponentDefinition = {
    id: 'swell_page',
    // label: 'Page: ' + pageId,
    label: 'Page settings',
    schema: [
      {
        prop: SECTION_GROUP_CONTENT,
        type: 'component-collection',
        required: true,
        noInline: NO_INLINE,
        accepts: getAcceptedSections(allSections, layoutSectionGroups, pageId),
        placeholderAppearance: {
          height: 250,
          label: 'Add section',
          aspectRatio: 1,
        },
      } as ExternalSchemaProp,
      ...getLayoutSectionGroupComponentProps(allSections, layoutSectionGroups),
    ],

    allowSave: true,
    styles: () => {
      return {
        styled: {
          Root: {},
        },
      };
    },
  };

  const components: NoCodeComponentDefinition[] = [
    rootComponent,
    pageComponent,
    ...getAllSectionComponents(allSections),
  ];

  const colorSchemeGroup = rootComponent.schema.find(
    (field) => field.prop === 'color_schemes',
  );

  if (colorSchemeGroup) {
    const params = (colorSchemeGroup as ExternalSchemaProp)
      .params as unknown as ThemeSettingFieldSchema;

    const { fields = [] } = params;

    components.push({
      id: 'swell_color_scheme_group',
      label: 'Swell color scheme',
      schema: fields.map<ExternalSchemaProp>((field) => ({
        prop: toEasyblocksFieldId(field.id),
        label: field.label,
        optional: true,
        ...schemaToEasyblocksProps({
          ...field,
          type: field.id === 'background_gradient' ? 'text' : field.type,
        }),
      })),
      styles() {
        return {
          styled: {
            Root: {},
          },
        };
      },
    });
  }

  const componentSet = new Set<string>();
  for (const component of components) {
    componentSet.add(component.id);
  }

  const templates: InternalTemplate[] = [
    // TODO: add templates for all other components (sections) with preset setting defaults
    {
      id: 'swell_global',
      entry: {
        _id: 'swell_global',
        _component: 'swell_global',
        ...getEditorSchemaTemplateValues(themeGlobals),
        $locale: themeGlobals?.configs?.theme?.$locale as string,
        swell_page: [
          {
            _id: 'swell_page',
            _component: 'swell_page',
            [SECTION_GROUP_CONTENT]: pageSections
              .filter((config) => componentSet.has(config.section.type))
              .map<NoCodeComponentEntry>(({ section, settings, schema }) => ({
                _id: prepareSectionId(section.id),
                _component: section.type,
                custom_css: settings?.section?.custom_css || '',
                disabled: settings?.section?.disabled || false,
                $locale: settings?.section?.settings?.$locale as string,
                ...reduce(
                  schema?.fields,
                  (acc, field) => {
                    if (field?.id) {
                      acc[field.id] = schemaToEasyblocksValue(
                        schema?.fields,
                        field.id,
                        settings?.section?.settings?.[field.id],
                      );
                    }

                    return acc;
                  },
                  {} as Record<string, unknown>,
                ),
                ...(section?.blocks
                  ? {
                      Blocks: Object.entries(section.blocks).map(
                        ([key, block]): NoCodeComponentEntry => {
                          return {
                            _id: `Block__${key}__${block.type}_${Math.random()}`,
                            _component: `Block__${section.type}__${block.type}`,
                            disabled: block.disabled || false,
                            ...reduce(
                              block.settings,
                              (acc, value, key) => {
                                acc[key] = schemaToEasyblocksValue(
                                  schema?.blocks?.find(
                                    ({ type }) => type === block.type,
                                  )?.fields,
                                  key,
                                  value,
                                );

                                return acc;
                              },
                              {} as Record<string, unknown>,
                            ),
                          };
                        },
                      ),
                    }
                  : undefined),
              })),
            ...getLayoutSectionGroupTemplateValues(layoutSectionGroups),
          },
        ],
      },
    },
    {
      id: 'swell_page',
      entry: {
        _id: 'swell_page',
        _component: 'swell_page',
      },
    },
    ...getAllSectionComponentTemplates(allSections),
  ];

  return {
    easyblocksConfig: {
      components,
      templates,
      backend: getEasyblocksBackend(),
      hideCloseButton: true,
      allowSave: true,
      readOnly: false,
      locales: [
        {
          code: 'en-US',
          isDefault: true,
        },
      ],
      types: {
        swell_css: {
          type: 'inline',
          widget: {
            id: 'SwellCSS',
          },
        },
        swell_locale: {
          type: 'inline',
          widget: {
            id: 'SwellLocale',
          },
        },
        swell_boolean: {
          type: 'inline',
          widget: {
            id: 'SwellBoolean',
          },
        },
        swell_color: {
          type: 'inline',
          widget: {
            id: 'SwellColor',
          },
        },
        swell_color_scheme: {
          type: 'inline',
          widget: {
            id: 'SwellColorScheme',
          },
        },
        swell_color_scheme_group: {
          type: 'inline',
          widget: {
            id: 'SwellColorSchemeGroup',
          },
        },
        swell_font: {
          type: 'inline',
          widget: {
            id: 'SwellFont',
          },
        },
        swell_header: {
          type: 'inline',
          widget: {
            id: 'SwellHeader',
          },
        },
        swell_icon: {
          type: 'inline',
          widget: {
            id: 'SwellIcon',
          },
        },
        swell_lookup: {
          type: 'inline',
          widget: {
            id: 'SwellLookup',
          },
        },
        swell_menu: {
          type: 'inline',
          widget: {
            id: 'SwellMenu',
          },
        },
        swell_url: {
          type: 'inline',
          widget: {
            id: 'SwellUrl',
          },
        },
        swell_number: {
          type: 'inline',
          widget: {
            id: 'SwellNumber',
          },
        },
        swell_select: {
          type: 'inline',
          widget: {
            id: 'SwellSelect',
          },
        },
        swell_radio: {
          type: 'inline',
          widget: {
            id: 'SwellRadio',
          },
        },
        swell_short_text: {
          type: 'inline',
          widget: {
            id: 'SwellText',
          },
        },
        swell_long_text: {
          type: 'inline',
          widget: {
            id: 'SwellTextarea',
          },
        },
        swell_paragraph: {
          type: 'inline',
          widget: {
            id: 'SwellParagraph',
          },
        },
        swell_editor: {
          type: 'inline',
          widget: {
            id: 'SwellEditor',
          },
        },
        swell_file: {
          type: 'inline',
          widget: {
            id: 'SwellFile',
          },
        },
        swell_image: {
          type: 'inline',
          widget: {
            id: 'SwellImage',
          },
        },
      },
      tokens: {
        colors: [],
        fonts: [],
      },
    },
  };
}

export function getEasyblocksComponentDefinitions(
  allSections: ThemePageSectionSchema[],
  layoutSectionGroups: ThemeLayoutSectionGroupConfig[],
  getComponent: (type: string, data?: unknown) => React.ComponentType,
): Record<string, React.ComponentType> {
  const pageSectionComponents = allSections.reduce(
    (acc, section) => {
      acc[`${section.id}`] = getComponent('pageSection', section);
      return acc;
    },
    {} as Record<string, React.ComponentType>,
  );

  const layoutSectionGroupComponents = layoutSectionGroups.reduce(
    (acc, sectionGroup) => {
      acc[getSectionGroupProp(sectionGroup.id)] = getComponent(
        'layoutSectionGroup',
        sectionGroup,
      );
      return acc;
    },
    {} as Record<string, React.ComponentType>,
  );

  const blockComponents = allSections.reduce(
    (acc, section) => {
      if (section.blocks) {
        for (const block of section.blocks) {
          const blockId = `Block__${section.id}__${block.type}`;
          acc[blockId] = getComponent('block', { section, block });
        }
      }
      return acc;
    },
    {} as Record<string, React.ComponentType>,
  );

  return {
    ...pageSectionComponents,
    ...layoutSectionGroupComponents,
    ...blockComponents,
    // Root component
    swell_page: getComponent('root'),
    swell_global: getComponent('global'),
  };
}

export function getEasyblocksBackend() {
  // Only a mock backend for now
  const easyblocksBackend: Backend = {
    documents: {
      get({ id }) {
        console.log('Easyblocks backend documents.get()', id);
        const document = {
          id,
          version: 1,
          entry: {
            _id: 'page',
            _component: 'swell_page',
          },
        } as Document;
        return Promise.resolve(document);
      },
      create(payload) {
        console.log('Easyblocks backend documents.create()', payload);
        return Promise.resolve({} as Document);
      },
      update(payload) {
        console.log('Easyblocks backend documents.update()', payload);
        return Promise.resolve({} as Document);
      },
    },
    templates: {
      get(payload) {
        console.log('Easyblocks backend templates.get()', payload);
        return Promise.resolve({} as UserDefinedTemplate);
      },
      getAll() {
        console.log('Easyblocks backend get templates.getAll()');
        return Promise.resolve([] as UserDefinedTemplate[]);
      },
      create(payload) {
        console.log('Easyblocks backend get templates.create()', payload);
        return Promise.resolve({} as UserDefinedTemplate);
      },
      update(payload) {
        console.log('Easyblocks backend get templates.update()', payload);
        return Promise.resolve({} as UserDefinedTemplate);
      },
      delete(payload) {
        console.log('Easyblocks backend get templates.delete()', payload);
        return Promise.resolve();
      },
    },
  };

  return easyblocksBackend;
}

function getRandomId(): string {
  return (Math.random() + 1).toString(36).substring(7);
}
