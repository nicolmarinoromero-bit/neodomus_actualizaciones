import { describe, expect, it } from 'vitest';
import { cumpleRequisitosPassword } from './password';

describe('cumpleRequisitosPassword', () => {
  it('acepta una contraseña con mayúscula, minúscula, número y símbolo', () => {
    expect(cumpleRequisitosPassword('Segura1!')).toBe(true);
  });

  it.each([
    ['corta', 'Ab1!'],
    ['sin mayúscula', 'segura1!'],
    ['sin minúscula', 'SEGURA1!'],
    ['sin número', 'Segura!!'],
    ['sin símbolo', 'Segura11'],
  ])('rechaza la contraseña %s', (_caso, valor) => {
    expect(cumpleRequisitosPassword(valor)).toBe(false);
  });
});
