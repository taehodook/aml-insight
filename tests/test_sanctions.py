import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('sanctions', Path(__file__).parents[1] / 'scripts/sanctions_update.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)

class SourceTests(unittest.TestCase):
    def test_eu_type_codes_and_unknown_fail_closed(self):
        self.assertEqual(s.eu_kind('P'), '개인')
        self.assertEqual(s.eu_kind('E'), '단체')
        with self.assertRaises(ValueError):
            s.eu_kind('')

    def test_eu_aliases_keep_identity_and_type(self):
        data = ('fileGenerationDate;Entity_EU_ReferenceNumber;NameAlias_WholeName;Entity_SubjectType\n'
                '23/10/2026;EU.1;Kim;P\n23/10/2026;EU.1;Kim Alias;P\n').encode()
        rows, date = s.parse_eu(data)
        self.assertEqual(date, '2026-10-23')
        self.assertEqual([r[4] for r in rows], ['개인', '개인'])
        self.assertEqual(rows[0][1], rows[1][1])

    def test_ofac_namespace_and_aliases(self):
        data = b'<sdnList xmlns="urn:test"><publshInformation><Publish_Date>10/21/2026</Publish_Date><Record_Count>1</Record_Count></publshInformation><sdnEntry><uid>1</uid><lastName>Kim</lastName><firstName>Jong</firstName><sdnType>Individual</sdnType><akaList><aka><lastName>Alias</lastName></aka></akaList></sdnEntry></sdnList>'
        rows, date = s.parse_ofac(data)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0][4], '개인')
        self.assertEqual(date, '2026-10-21')

    def test_small_or_truncated_lists_rejected(self):
        with self.assertRaises(ValueError):
            s.validate([], 'EU', 6000)
        with self.assertRaises(ValueError):
            s.validate([['EU','1','name','','개인']] * 1200, 'EU', 6000)

if __name__ == '__main__':
    unittest.main()
