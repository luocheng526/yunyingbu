import unittest
from pathlib import Path

from hejun_reader.resolve import ResolveError, resolve_in_modules, resolve_source

OVERVIEW = r"""
function post(url, body){return Promise.resolve(body)}
function bv(e,t){return post(`/v2/channel/channelOverViewList`,e)}
function xv(e,t){return post(`/v2/channel/dynamicChannelAnalysis`,e)}
export{bv as tn,xv as q1};
"""

GOODS = r"""
function X(url, body){return Promise.resolve(body)}
function Xc(e,t={}){let n=t;return X(`/v2/goods/overViewPageList`,e)}
export{Xc as wo};
"""

GENERATOR = r"""
var jf=function(){var e=k(function*(e,t){return J(`/abilityImprovement/getVideoDetail`,e,t)});return e}();
export{jf as Zi};
"""

AMBIGUOUS = r"""
function Sv(e,t){return X(`/v2/channel/dynamicDetailAnalysis`,e)}
function Cv(e,t){return X(`/v2/channel/dynamicDetailAnalysis`,e)}
export{Sv as Yt,Cv as $t};
"""

NOT_EXPORTED = r"""
function bv(e,t){return post(`/v2/channel/channelOverViewList`,e)}
export{post as p};
"""


class ResolveTests(unittest.TestCase):
    def test_overview_alias_follows_the_real_bundle_shape(self):
        resolved = resolve_source(OVERVIEW, "/v2/channel/channelOverViewList", "https://bi.example/api.js")
        self.assertEqual(resolved.local_name, "bv")
        self.assertEqual(resolved.export_name, "tn")

    def test_nested_return_still_finds_the_function(self):
        resolved = resolve_source(GOODS, "/v2/goods/overViewPageList", "https://bi.example/goods.js")
        self.assertEqual((resolved.local_name, resolved.export_name), ("Xc", "wo"))

    def test_assigned_function_is_exported(self):
        resolved = resolve_source(GENERATOR, "/abilityImprovement/getVideoDetail", "https://bi.example/video.js")
        self.assertEqual((resolved.local_name, resolved.export_name), ("jf", "Zi"))

    def test_two_exports_are_an_error(self):
        with self.assertRaises(ResolveError) as caught:
            resolve_source(AMBIGUOUS, "/v2/channel/dynamicDetailAnalysis")
        self.assertEqual(caught.exception.code, "ambiguous")

    def test_unexported_function_is_an_error(self):
        with self.assertRaises(ResolveError) as caught:
            resolve_source(NOT_EXPORTED, "/v2/channel/channelOverViewList")
        self.assertEqual(caught.exception.code, "not_exported")

    def test_missing_path_is_an_error(self):
        with self.assertRaises(ResolveError) as caught:
            resolve_in_modules([("https://bi.example/api.js", OVERVIEW)], "/v2/channel/missing")
        self.assertEqual(caught.exception.code, "not_found")

    def test_downloaded_bundle_if_present(self):
        bundle = Path("/tmp/bi-js/shared.js")
        if not bundle.exists():
            self.skipTest("downloaded BI bundle is not on this machine")
        resolved = resolve_source(bundle.read_text(encoding="utf-8", errors="replace"), "/v2/channel/channelOverViewList", "shared.js")
        self.assertEqual(resolved.local_name, "bv")
        self.assertEqual(resolved.export_name, "tn")
        goods = resolve_source(bundle.read_text(encoding="utf-8", errors="replace"), "/v2/goods/overViewPageList", "shared.js")
        self.assertEqual(goods.local_name, "Xc")
        self.assertEqual(goods.export_name, "wo")
        with self.assertRaises(ResolveError) as caught:
            resolve_source(bundle.read_text(encoding="utf-8", errors="replace"), "/v2/channel/dynamicDetailAnalysis", "shared.js")
        self.assertEqual(caught.exception.code, "ambiguous")
        video = resolve_source(bundle.read_text(encoding="utf-8", errors="replace"), "/abilityImprovement/getVideoDetail", "shared.js")
        self.assertEqual((video.local_name, video.export_name), ("jf", "Zi"))


if __name__ == "__main__":
    unittest.main()
