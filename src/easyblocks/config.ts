import { reduce } from 'lodash-es';
import type {
  Backend,
  Document,
  UserDefinedTemplate,
} from '@swell/easyblocks-core';

import { SwellTheme } from '../theme';
import {
  getAllSections,
  getPageSections,
  getLayoutSectionGroups,
  schemaToEasyblocksProps,
  schemaToEasyblocksValue,
} from './utils';

import type {
  SwellThemeConfig,
  ThemeGlobals,
  ThemeLayoutSectionGroupConfig,
  ThemePageSectionSchema,
  ThemeSectionConfig,
  ThemeSectionEnabledDisabled,
  ThemeSectionGroup,
} from 'types/swell';

export async function getEasyblocksPropsFromThemeConfigs(
  theme: SwellTheme,
  themeConfigs: SwellThemeConfig[],
  pageId: string,
) {
  const pageTemplate = await getEasyblocksPageTemplate(theme, pageId);
  const allSections = await getAllSections(theme, themeConfigs);
  const pageSections = await getPageSections(
    theme,
    pageTemplate as ThemeSectionGroup,
  );
  const layoutSectionGroups = await getLayoutSectionGroups(theme, themeConfigs);

  return {
    pageTemplate,
    allSections,
    pageSections,
    layoutSectionGroups,
  };
}

export async function getEasyblocksPageTemplate(
  theme: SwellTheme,
  pageId: string,
) {
  let templateConfig: SwellThemeConfig | null = null;

  templateConfig = await theme.getThemeTemplateConfigByType(
    'templates',
    pageId,
  );

  if (templateConfig) {
    return JSON.parse(templateConfig.file_data);
  }
}

function getAcceptedLayoutSections(
  allSections: ThemePageSectionSchema[],
  groupType: string,
) {
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
) {
  return layoutSectionGroups.map((sectionGroup) => ({
    prop: `SectionGroup_${sectionGroup.id}`,
    type: 'component-collection',
    required: true,
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
) {
  return allSections.reduce((acc: string[], section) => {
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

function getEditorSchemaComponentProps(themeGlobals: ThemeGlobals) {
  return (themeGlobals?.configs?.editor?.settings ?? []).reduce(
    (acc: any[], settingGroup) => {
      for (const field of settingGroup.fields || []) {
        if (field?.id) {
          acc.push({
            prop: field.id,
            label: field.label,
            optional: true,
            group: settingGroup.label,
            ...schemaToEasyblocksProps(field),
          });
        }
      }

      return acc;
    },
    [],
  );
}

function getAllSectionComponents(allSections: ThemePageSectionSchema[]) {
  const list: unknown[] = [];

  for (const section of allSections) {
    const hasBlocks =
      Array.isArray(section.blocks) && section.blocks.length > 0;

    list.push({
      id: `${section.id}`,
      label: section.label,
      schema: [
        ...(section.fields || []).reduce((acc: any[], field) => {
          if (field.id && field.type) {
            acc.push({
              prop: field.id,
              label: field.label,
              optional: true,
              ...schemaToEasyblocksProps(field),
            });
          }

          return acc;
        }, []),
        ...(hasBlocks
          ? [
              {
                prop: 'Blocks',
                type: 'component-collection',
                required: true,
                accepts: (section.blocks || []).map(
                  (block) => `Block__${section.id}__${block.type}`,
                ),
                // TODO: figure out how to make this work, doesn't work for collections normally
                defaultValue: section.presets?.[0]?.blocks?.reduce(
                  (acc: any[], block) => {
                    const blockDef = section.blocks?.find(
                      ({ type }) => type === block.type,
                    );

                    if (blockDef) {
                      acc.push({
                        _component: `Block__${section.id}__${block.type}`,
                        ...reduce(
                          blockDef.fields,
                          (acc: any, blockField) => {
                            if (blockField.id) {
                              acc[blockField.id] = schemaToEasyblocksValue(
                                blockDef.fields,
                                blockField.id,
                                blockField.default,
                              );
                            }

                            return acc;
                          },
                          {},
                        ),
                      });
                    }

                    return acc;
                  },
                  [],
                ),
                placeholderAppearance: {
                  height: 50,
                  label: 'Add block',
                  aspectRatio: 1,
                },
              },
            ]
          : []),
        {
          prop: 'custom_css',
          type: 'swell_long_text',
          label: 'Custom CSS',
          description: 'Add custom CSS for this section',
          layout: 'column',
          isLabelHidden: true,
          params: {
            rows: 5,
            placeholder: 'Enter custom CSS...',
          },
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
        ...(section.blocks || []).map((block) => ({
          id: `Block__${section.id}__${block.type}`,
          label: block.label,
          schema: (block.fields || []).reduce((acc: any[], field) => {
            if (field.id && field.type) {
              acc.push({
                prop: field.id,
                label: field.label,
                optional: true,
                ...schemaToEasyblocksProps(field),
              });
            }

            return acc;
          }, []),
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

function getEditorSchemaTemplateValues(themeGlobals: ThemeGlobals) {
  return themeGlobals?.configs?.editor?.settings?.reduce(
    (acc: any, settingGroup) => {
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
    {},
  );
}

function getLayoutSectionGroupTemplateValues(
  layoutSectionGroups: ThemeLayoutSectionGroupConfig[],
) {
  return layoutSectionGroups.reduce((acc: any, sectionGroup) => {
    acc[`SectionGroup_${sectionGroup.id}`] = sectionGroup.sectionConfigs.map(
      ({ section, settings, schema }) => ({
        _id: `SectionGroup__${section.type}_${getRandomId()}`,
        _component: `${section.type}`,
        ...reduce(
          settings?.section.settings,
          (acc: any, value, key) => {
            acc[key] = schemaToEasyblocksValue(schema?.fields, key, value);
            return acc;
          },
          {},
        ),
        ...(settings?.section.blocks
          ? {
              Blocks: settings.section.blocks.map((block) => ({
                _id: `Block__${section.type}__${block.type}_${getRandomId()}`,
                _component: `Block__${section.type}__${block.type}`,
                ...reduce(
                  block.settings,
                  (acc: any, value, key) => {
                    acc[key] = schemaToEasyblocksValue(
                      schema?.blocks?.find(({ type }) => type === block.type)
                        ?.fields,
                      key,
                      value,
                    );

                    return acc;
                  },
                  {},
                ),
              })),
            }
          : undefined),
      }),
    );

    return acc;
  }, {});
}

function getAllSectionComponentTemplates(
  allSections: ThemePageSectionSchema[],
) {
  const list: unknown[] = [];

  for (const section of allSections) {
    if (section.presets) {
      list.push(
        ...section.presets.map((preset, index) => ({
          id: `${section.id}__preset_${index}`,
          entry: {
            _id: `${section.id}__preset_${index}`,
            _component: section.id,
            custom_css: preset.settings?.['custom_css'],
            ...reduce(
              section.fields,
              (acc: any, field: any) => {
                acc[field.id] = schemaToEasyblocksValue(
                  section.fields,
                  field.id,
                  preset.settings?.[field.id],
                );

                return acc;
              },
              {},
            ),
            Blocks: preset.blocks?.reduce((acc: any[], block) => {
              const blockDef = section.blocks?.find(
                ({ type }) => type === block.type,
              );

              if (blockDef) {
                acc.push({
                  _id: `Block__${section.id}__${block.type}__preset_${index}`,
                  _component: `Block__${section.id}__${block.type}`,
                  ...reduce(
                    blockDef.fields,
                    (acc: any, blockField) => {
                      if (blockField.id) {
                        acc[blockField.id] = schemaToEasyblocksValue(
                          blockDef.fields,
                          blockField.id,
                          block.settings?.[blockField.id],
                        );
                      }

                      return acc;
                    },
                    {},
                  ),
                });
              }

              return acc;
            }, []),
          },
        })),
      );
    }

    if (section.blocks) {
      list.push(
        ...section.blocks.map((block) => ({
          id: `Block__${section.id}__${block.type}`,
          entry: {
            _id: `Block__${section.id}__${block.type}`,
            _component: `Block__${section.id}__${block.type}`,
            ...reduce(
              block.fields,
              (acc: any, field) => {
                if (field.id && field.default !== undefined) {
                  acc[field.id] = schemaToEasyblocksValue(
                    block.fields,
                    field.id,
                    field.default,
                  );
                }

                return acc;
              },
              {},
            ),
          },
        })),
      );
    }
  }

  // Filter templates with settings because
  // easyblocks creates a default template for each component otherwise
  return list.filter((template: any) => {
    return Object.keys(template.entry).some(
      (key) => key !== '_id' && key !== '_component',
    );
  });
}

export function getEasyblocksPagePropsWithConfigs(
  themeGlobals: ThemeGlobals,
  allSections: ThemePageSectionSchema[],
  pageSections: ThemeSectionConfig[],
  layoutSectionGroups: ThemeLayoutSectionGroupConfig[],
  pageId: string,
) {
  const rootComponent = {
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
        noInline: true,
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

  const pageComponent = {
    id: 'swell_page',
    // label: 'Page: ' + pageId,
    label: 'Page settings',
    schema: [
      {
        prop: 'ContentSections',
        type: 'component-collection',
        required: true,
        accepts: getAcceptedSections(allSections, layoutSectionGroups, pageId),
        placeholderAppearance: {
          height: 250,
          label: 'Add section',
          aspectRatio: 1,
        },
      },
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

  const components = [
    rootComponent,
    pageComponent,
    ...getAllSectionComponents(allSections),
  ];

  const colorSchemeGroup = rootComponent.schema.find(
    (field) => field.prop === 'color_schemes',
  );

  if (colorSchemeGroup) {
    const { params } = colorSchemeGroup;

    components.push({
      id: 'swell_color_scheme_group',
      label: 'Swell color scheme',
      schema: params.fields.map((field: any) => ({
        prop: field.id,
        type: field.id === 'background_gradient' ? 'text' : field.type,
        label: field.label,
        description: field.description,
        defaultValue: { value: field.default },
        required: true,
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

  const templates = [
    // TODO: add templates for all other components (sections) with preset setting defaults
    {
      id: 'swell_global',
      entry: {
        _id: 'swell_global',
        _component: 'swell_global',
        ...getEditorSchemaTemplateValues(themeGlobals),
        swell_page: [
          {
            _id: `swell_page`,
            _component: `swell_page`,
            ContentSections: pageSections.map(
              ({ section, settings, schema }) => ({
                _id: `${section.type}_${Math.random()}`,
                _component: `${section.type}`,
                custom_css: settings?.section?.settings?.['custom_css'],
                ...reduce(
                  schema?.fields,
                  (acc, field) =>
                    field?.id
                      ? {
                          ...acc,
                          [field.id]: schemaToEasyblocksValue(
                            schema?.fields,
                            field.id,
                            settings?.section?.settings?.[field.id],
                          ),
                        }
                      : acc,
                  {},
                ),
                ...(section?.blocks
                  ? {
                      Blocks: Object.keys(section.blocks).map((key: any) => {
                        if (!section.blocks) return;
                        const block = section.blocks[key];
                        return {
                          _id: `Block__${key}__${block.type}_${Math.random()}`,
                          _component: `Block__${section.type}__${block.type}`,
                          ...reduce(
                            block.settings,
                            (acc, value, key) => ({
                              ...acc,
                              [key]: schemaToEasyblocksValue(
                                schema?.blocks?.find(
                                  ({ type }) => type === block.type,
                                )?.fields,
                                key,
                                value,
                              ),
                            }),
                            {},
                          ),
                        };
                      }),
                    }
                  : {}),
              }),
            ),
            ...getLayoutSectionGroupTemplateValues(layoutSectionGroups),
          },
        ],
      },
    },
    {
      id: `swell_page`,
      entry: {
        _id: `swell_page`,
        _component: `swell_page`,
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
  getComponent: (type: string, data?: any) => any,
) {
  const pageSectionComponents = allSections.reduce((acc: any, section) => {
    acc[`${section.id}`] = getComponent('pageSection', section);
    return acc;
  }, {});

  const layoutSectionGroupComponents = layoutSectionGroups.reduce(
    (acc: any, sectionGroup) => {
      acc[`SectionGroup___${sectionGroup.id}`] = getComponent(
        'layoutSectionGroup',
        sectionGroup,
      );
      return acc;
    },
    {},
  );

  const blockComponents = allSections.reduce((acc: any, section) => {
    if (section.blocks) {
      for (const block of section.blocks) {
        const blockId = `Block__${section.id}__${block.type}`;
        acc[blockId] = getComponent('block', { section, block });
      }
    }
    return acc;
  }, {});

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
      get: async ({ id }) => {
        console.log('Easyblocks backend documents.get()', id);
        const document = {
          id,
          version: 1,
          entry: {
            _id: 'page',
            _component: 'swell_page',
          },
        } as Document;
        return document;
      },
      create: async (payload) => {
        console.log('Easyblocks backend documents.create()', payload);
        return {} as Document;
      },
      update: async (payload) => {
        console.log('Easyblocks backend documents.update()', payload);
        return {} as Document;
      },
    },
    templates: {
      get: async (payload) => {
        console.log('Easyblocks backend templates.get()', payload);
        return {} as UserDefinedTemplate;
      },
      getAll: async () => {
        console.log('Easyblocks backend get templates.getAll()');
        return [] as UserDefinedTemplate[];
      },
      create: async (payload) => {
        console.log('Easyblocks backend get templates.create()', payload);
        return {} as UserDefinedTemplate;
      },
      update: async (payload) => {
        console.log('Easyblocks backend get templates.update()', payload);
        return {} as UserDefinedTemplate;
      },
      delete: async (payload) => {
        console.log('Easyblocks backend get templates.delete()', payload);
        return;
      },
    },
  };

  return easyblocksBackend;
}

function getRandomId() {
  return (Math.random() + 1).toString(36).substring(7);
}
